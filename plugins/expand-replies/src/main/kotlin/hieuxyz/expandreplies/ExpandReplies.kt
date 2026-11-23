@file:JvmName("ExpandReplies")

package hieuxyz.expandreplies

import android.graphics.Canvas
import android.graphics.Paint
import android.text.Layout
import android.text.Spannable
import android.text.SpannableStringBuilder
import android.text.Spanned
import android.text.TextUtils
import android.text.style.LeadingMarginSpan
import android.view.View
import android.view.ViewGroup
import android.widget.TextView
import app.valenced.bridge.asDelegate
import app.valenced.plugins.plugin
import app.valenced.xposed.api.DexFinder
import app.valenced.xposed.api.registerNativeMethod
import de.robv.android.xposed.XC_MethodHook
import de.robv.android.xposed.XposedBridge

private const val MESSAGE_VIEW = "com.discord.chat.presentation.message.MessageView"
private const val MESSAGE = "com.discord.chat.bridge.Message"

private class AdjustedLeadingMarginSpan(
    private val firstMargin: Int,
    private val restMargin: Int
) : LeadingMarginSpan {
    override fun getLeadingMargin(first: Boolean): Int = if (first) firstMargin else restMargin
    override fun drawLeadingMargin(
        c: Canvas?,
        p: Paint?,
        x: Int,
        dir: Int,
        top: Int,
        baseline: Int,
        bottom: Int,
        text: CharSequence?,
        start: Int,
        end: Int,
        first: Boolean,
        layout: Layout?
    ) {}
}

internal class ReplyHooks(private val dexFinder: DexFinder) {
    @Volatile
    var maxLines: Int = 0

    @Volatile
    var trueNewlines: Boolean = true

    @Volatile
    var alignWithLine1: Boolean = false

    private val unhooks = mutableListOf<XC_MethodHook.Unhook>()

    init {
        val setMessage = dexFinder.findMethod {
            matcher {
                declaredClass(MESSAGE_VIEW)
                usingEqStrings("message", "messageContext", "eventHandler")
            }
        } ?: dexFinder.findMethod {
            matcher {
                declaredClass(MESSAGE_VIEW)
                paramTypes(MESSAGE)
            }
        } ?: dexFinder.findMethod {
            matcher {
                declaredClass(MESSAGE_VIEW)
                usingEqStrings("message", "messageContext")
            }
        }

        if (setMessage != null) {
            unhooks += XposedBridge.hookMethod(setMessage, object : XC_MethodHook() {
                override fun afterHookedMethod(param: MethodHookParam) {
                    val view = param.thisObject as? ViewGroup ?: return
                    unclampReplies(view, maxLines, trueNewlines, alignWithLine1)
                }
            })
        }
    }

    fun dispose() {
        for (unhook in unhooks) unhook.unhook()
        unhooks.clear()
    }

    private fun unclampReplies(view: View, lines: Int, allowTrueNewlines: Boolean, alignSubsequent: Boolean) {
        val targetLines = if (lines <= 0) Int.MAX_VALUE else lines
        if (view is TextView) {
            val entryName = runCatching {
                if (view.id != View.NO_ID) view.resources.getResourceEntryName(view.id) else ""
            }.getOrDefault("")
            if (isReplyMatch(entryName) || isReplyMatch(view.javaClass.simpleName)) {
                applyExpansion(view, targetLines, allowTrueNewlines, alignSubsequent)
            }
        } else if (view is ViewGroup) {
            val groupEntry = runCatching {
                if (view.id != View.NO_ID) view.resources.getResourceEntryName(view.id) else ""
            }.getOrDefault("")
            val isGroupReply = isReplyMatch(groupEntry) || isReplyMatch(view.javaClass.simpleName)
            for (i in 0 until view.childCount) {
                val child = view.getChildAt(i) ?: continue
                if (isGroupReply && child is TextView) {
                    applyExpansion(child, targetLines, allowTrueNewlines, alignSubsequent)
                } else {
                    val childEntry = runCatching {
                        if (child.id != View.NO_ID) child.resources.getResourceEntryName(child.id) else ""
                    }.getOrDefault("")
                    if (!shouldSkipView(childEntry)) {
                        unclampReplies(child, lines, allowTrueNewlines, alignSubsequent)
                    }
                }
            }
        }
    }

    private fun applyExpansion(textView: TextView, targetLines: Int, allowTrueNewlines: Boolean, alignSubsequent: Boolean) {
        var needsLayout = false

        if (textView.maxLines != targetLines) {
            textView.maxLines = targetLines
            needsLayout = true
        }
        if (textView.isSingleLine) {
            textView.isSingleLine = false
            needsLayout = true
        }
        if (allowTrueNewlines) {
            if (textView.transformationMethod != null) {
                textView.transformationMethod = null
                needsLayout = true
            }
        }
        if (textView.ellipsize != TextUtils.TruncateAt.END) {
            textView.ellipsize = TextUtils.TruncateAt.END
            needsLayout = true
        }

        val text = textView.text
        if (text is Spannable) {
            val spans = text.getSpans(0, text.length, LeadingMarginSpan::class.java)
            if (spans.isNotEmpty()) {
                var firstLineMargin = 0
                for (span in spans) {
                    val m = span.getLeadingMargin(true)
                    if (m > firstLineMargin) {
                        firstLineMargin = m
                    }
                }
                if (firstLineMargin > 0) {
                    for (span in spans) {
                        text.removeSpan(span)
                    }
                    if (alignSubsequent) {
                        text.setSpan(
                            AdjustedLeadingMarginSpan(firstLineMargin, firstLineMargin),
                            0,
                            text.length,
                            Spanned.SPAN_EXCLUSIVE_EXCLUSIVE
                        )
                    } else {
                        val firstNewline = text.indexOf('\n')
                        val endOfPar0 = if (firstNewline >= 0) firstNewline + 1 else text.length
                        text.setSpan(
                            AdjustedLeadingMarginSpan(firstLineMargin, 0),
                            0,
                            endOfPar0,
                            Spanned.SPAN_EXCLUSIVE_EXCLUSIVE
                        )
                    }
                    needsLayout = true
                }
            }
        } else if (text is Spanned) {
            val spans = text.getSpans(0, text.length, LeadingMarginSpan::class.java)
            if (spans.isNotEmpty()) {
                var firstLineMargin = 0
                for (span in spans) {
                    val m = span.getLeadingMargin(true)
                    if (m > firstLineMargin) {
                        firstLineMargin = m
                    }
                }
                if (firstLineMargin > 0) {
                    val builder = SpannableStringBuilder(text)
                    for (span in builder.getSpans(0, builder.length, LeadingMarginSpan::class.java)) {
                        builder.removeSpan(span)
                    }
                    if (alignSubsequent) {
                        builder.setSpan(
                            AdjustedLeadingMarginSpan(firstLineMargin, firstLineMargin),
                            0,
                            builder.length,
                            Spanned.SPAN_EXCLUSIVE_EXCLUSIVE
                        )
                    } else {
                        val firstNewline = builder.indexOf('\n')
                        val endOfPar0 = if (firstNewline >= 0) firstNewline + 1 else builder.length
                        builder.setSpan(
                            AdjustedLeadingMarginSpan(firstLineMargin, 0),
                            0,
                            endOfPar0,
                            Spanned.SPAN_EXCLUSIVE_EXCLUSIVE
                        )
                    }
                    textView.text = builder
                    needsLayout = true
                }
            }
        }

        if (needsLayout && !textView.isInLayout) {
            textView.requestLayout()
            textView.invalidate()
        }
    }

    private fun isReplyMatch(name: String): Boolean {
        if (name.isEmpty()) return false
        val lower = name.lowercase()
        return lower.contains("reply") || lower.contains("referenced")
    }

    private fun shouldSkipView(name: String): Boolean {
        if (name.isEmpty()) return false
        val lower = name.lowercase()
        return lower.contains("accessories") || lower.contains("reaction") || lower.contains("embed")
    }
}

val expandReplies = plugin {
    var hooks: ReplyHooks? = null

    start {
        hooks = ReplyHooks(dexFinder)

        registerNativeMethod("hieuxyz.expandreplies.setLimits") { rawArgs ->
            val args = rawArgs.asDelegate()
            val lines: Int by args.int()
            val allowNewlines: Boolean by args.boolean()
            val alignSubsequent: Boolean by args.boolean()
            hooks?.maxLines = lines
            hooks?.trueNewlines = allowNewlines
            hooks?.alignWithLine1 = alignSubsequent
            null
        }
    }

    stop {
        hooks?.dispose()
        hooks = null
    }
}