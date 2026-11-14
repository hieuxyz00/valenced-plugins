@file:JvmName("StaffTags")

package hieuxyz.stafftags

import android.content.Context
import android.graphics.drawable.Drawable
import android.graphics.drawable.GradientDrawable
import android.view.View
import android.view.ViewGroup
import android.widget.ImageView
import android.widget.TextView
import app.valenced.bridge.asDelegate
import app.valenced.plugins.plugin
import app.valenced.xposed.api.DexFinder
import app.valenced.xposed.api.registerNativeMethod
import de.robv.android.xposed.XC_MethodHook
import de.robv.android.xposed.XposedBridge
import org.json.JSONObject
import java.lang.reflect.Constructor
import java.lang.reflect.Field
import java.lang.reflect.Method
import java.lang.reflect.Modifier
import java.util.LinkedHashMap

private const val MESSAGE_VIEW = "com.discord.chat.presentation.message.MessageView"
private const val MESSAGE = "com.discord.chat.bridge.Message"
private const val DRAWEE_VIEW = "com.facebook.drawee.view.SimpleDraweeView"
private const val CACHE_CAPACITY = 2000
private const val ICON_TAG = "staff_tag_drawee_icon"

internal data class TagInfo(
    val text: String,
    val icon: String? = null,
    val assetUri: String? = null,
    val textColor: Int? = null,
    val backgroundColor: Int? = null,
    val gradientColors: IntArray? = null,
    val gradientOrientation: String? = null,
)

internal class TagHooks(private val dexFinder: DexFinder) {
    private val tags = object : LinkedHashMap<String, TagInfo>(256, 0.75f, true) {
        override fun removeEldestEntry(eldest: MutableMap.MutableEntry<String, TagInfo>) = size > CACHE_CAPACITY
    }

    private val messageIdField: Field? = runCatching {
        dexFinder.classLoader.loadClass(MESSAGE).getDeclaredField("id").apply { isAccessible = true }
    }.getOrNull()

    private val draweeConstructor: Constructor<*>? = runCatching {
        dexFinder.classLoader.loadClass(DRAWEE_VIEW).getConstructor(Context::class.java)
    }.getOrNull()

    private val reactAssetClass: Class<*>? = runCatching {
        dexFinder.findClass {
            matcher {
                superClass("java.lang.Enum")
                usingEqStrings("ClockWarningIcon")
            }
        } ?: dexFinder.findClass {
            matcher {
                superClass("java.lang.Enum")
                usingEqStrings("ShieldUserIcon")
            }
        } ?: dexFinder.findClass {
            matcher {
                superClass("java.lang.Enum")
                usingEqStrings("CrownIcon")
            }
        } ?: runCatching {
            dexFinder.classLoader.loadClass("com.discord.react_asset.ReactAsset")
        }.getOrNull()
    }.getOrNull()

    private val setReactAsset: Method? = runCatching {
        val assetClass = reactAssetClass ?: return@runCatching null
        dexFinder.findMethod {
            matcher {
                modifiers(Modifier.STATIC)
                paramTypes(DRAWEE_VIEW, assetClass.name)
            }
        } ?: runCatching {
            dexFinder.classLoader.loadClass("com.discord.react_asset.ReactAssetUtilsKt")
                .getDeclaredMethod("setReactAsset", dexFinder.classLoader.loadClass(DRAWEE_VIEW), assetClass)
        }.getOrNull() ?: runCatching {
            dexFinder.classLoader.loadClass("com.discord.react_asset.ReactAssetUtils")
                .getDeclaredMethod("setReactAsset", dexFinder.classLoader.loadClass(DRAWEE_VIEW), assetClass)
        }.getOrNull()
    }.getOrNull()

    private val setTintColor: Method? = runCatching {
        dexFinder.findMethod {
            matcher {
                modifiers(Modifier.STATIC)
                paramTypes(DRAWEE_VIEW, "java.lang.Integer")
                returnType("void")
            }
        } ?: runCatching {
            dexFinder.classLoader.loadClass("com.discord.react_asset.ReactAssetUtilsKt")
                .getDeclaredMethod("setTintColor", dexFinder.classLoader.loadClass(DRAWEE_VIEW), Int::class.javaObjectType)
        }.getOrNull() ?: runCatching {
            dexFinder.classLoader.loadClass("com.discord.react_asset.ReactAssetUtils")
                .getDeclaredMethod("setTintColor", dexFinder.classLoader.loadClass(DRAWEE_VIEW), Int::class.javaObjectType)
        }.getOrNull()
    }.getOrNull()

    private var ids: ViewIds? = null
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
                    val message = param.args.getOrNull(0) ?: return
                    val id = runCatching {
                        val raw = messageIdField?.get(message)
                        when (raw) {
                            is String -> raw
                            null -> {
                                val m = message.javaClass.methods.firstOrNull { it.name in listOf("getId", "getMessageId") && it.parameterCount == 0 }
                                m?.invoke(message)?.toString()
                            }
                            else -> {
                                val inner = runCatching { raw.javaClass.getDeclaredField("id").apply { isAccessible = true }.get(raw)?.toString() }.getOrNull()
                                inner ?: raw.toString()
                            }
                        }
                    }.getOrNull() ?: return
                    val tag = synchronized(tags) { tags[id] } ?: return

                    val ids = ids ?: ViewIds(view).also { ids = it }
                    val header = (view.childWithId(ids.header) as? ViewGroup)
                        ?: (if (ids.header != 0) view.findViewById<ViewGroup>(ids.header) else null)
                        ?: view

                    bindTag(view.context, header, ids, tag)
                }
            })
        }
    }

    fun put(json: String) {
        val obj = JSONObject(json)
        val updates = mutableMapOf<String, TagInfo>()
        val keys = obj.keys()
        while (keys.hasNext()) {
            val key = keys.next()
            val item = obj.getJSONObject(key)
            val text = item.optString("text", "")
            val icon = item.optString("icon").takeIf { it.isNotBlank() }
            val assetUri = item.optString("assetUri").takeIf { it.isNotBlank() }
            val textColor = if (item.has("textColor") && !item.isNull("textColor")) item.getInt("textColor") else null
            val backgroundColor = if (item.has("backgroundColor") && !item.isNull("backgroundColor")) item.getInt("backgroundColor") else null
            val gradArray = item.optJSONArray("gradient")
            val gradientColors = if (gradArray != null && gradArray.length() >= 2) {
                IntArray(gradArray.length()) { gradArray.getInt(it) }
            } else null
            val gradientOrientation = item.optString("gradientOrientation").takeIf { it.isNotBlank() }
            updates[key] = TagInfo(text, icon, assetUri, textColor, backgroundColor, gradientColors, gradientOrientation)
        }
        synchronized(tags) { tags.putAll(updates) }
    }

    fun clear() {
        synchronized(tags) { tags.clear() }
    }

    fun dispose() {
        for (unhook in unhooks) unhook.unhook()
        unhooks.clear()
        synchronized(tags) { tags.clear() }
    }

    private fun bindTag(context: Context, header: ViewGroup, ids: ViewIds, tag: TagInfo) {
        val tagTextView = findTagTextView(header, ids, tag.text) ?: return

        // 1. Text color
        if (tag.textColor != null) {
            tagTextView.setTextColor(tag.textColor)
        }

        val density = context.resources.displayMetrics.density
        val chiplet = findChipletContainer(header, ids, tagTextView)
        chiplet.visibility = View.VISIBLE
        tagTextView.visibility = View.VISIBLE

        // 2. Icon rendering (Discord ReactAsset vector icon via Fresco, native Drawable, or Unicode Emoji)
        val iconName = tag.icon?.trim()
        val existingDrawee = if (chiplet is ViewGroup) chiplet.findViewWithTag<View>(ICON_TAG) as? ImageView else null

        val fallbackDrawable = if (!iconName.isNullOrBlank()) loadFallbackDrawable(context, iconName, tag.assetUri) else null

        if (fallbackDrawable != null) {
            if (chiplet is ViewGroup) {
                val toRemove = (0 until chiplet.childCount)
                    .mapNotNull { chiplet.getChildAt(it) }
                    .filter { it.tag == ICON_TAG }
                for (v in toRemove) chiplet.removeView(v)
            }
            existingDrawee?.visibility = View.GONE

            val size = (12 * density).toInt()
            fallbackDrawable.mutate()
            fallbackDrawable.setBounds(0, 0, size, size)
            if (tag.textColor != null) {
                fallbackDrawable.setTint(tag.textColor)
            }
            tagTextView.setCompoundDrawablesRelative(fallbackDrawable, null, null, null)
            tagTextView.compoundDrawablePadding = (4 * density).toInt()
            tagTextView.text = tag.text
        } else if (!iconName.isNullOrBlank() && iconName.contains("Icon")) {
            val assetClass = reactAssetClass
            val constant = assetClass?.let { resolveEnumConstant(it, iconName) }
            val constructor = draweeConstructor
            val setAsset = setReactAsset
            val setTint = setTintColor

            if (constant != null && constructor != null && setAsset != null && chiplet is ViewGroup) {
                val draweeView = existingDrawee ?: run {
                    val v = constructor.newInstance(context) as ImageView
                    v.tag = ICON_TAG
                    val iconSize = (12 * density).toInt()
                    val lp = ViewGroup.MarginLayoutParams(iconSize, iconSize).apply {
                        marginEnd = (4 * density).toInt()
                    }
                    val idx = chiplet.indexOfChild(tagTextView).takeIf { it >= 0 } ?: 0
                    chiplet.addView(v, idx, lp)
                    v
                }
                draweeView.visibility = View.VISIBLE
                runCatching { setAsset.invoke(null, draweeView, constant) }
                if (tag.textColor != null && setTint != null) {
                    runCatching { setTint.invoke(null, draweeView, tag.textColor) }
                }
                tagTextView.setCompoundDrawablesRelativeWithIntrinsicBounds(null, null, null, null)
                tagTextView.text = tag.text
            } else {
                existingDrawee?.visibility = View.GONE
                tagTextView.setCompoundDrawablesRelativeWithIntrinsicBounds(null, null, null, null)
                tagTextView.text = tag.text
            }
        } else if (!iconName.isNullOrBlank()) {
            // Unicode emoji (👑, 🔥, etc.)
            existingDrawee?.visibility = View.GONE
            tagTextView.setCompoundDrawablesRelativeWithIntrinsicBounds(null, null, null, null)
            tagTextView.text = "$iconName ${tag.text}"
        } else {
            existingDrawee?.visibility = View.GONE
            tagTextView.setCompoundDrawablesRelativeWithIntrinsicBounds(null, null, null, null)
            tagTextView.text = tag.text
        }

        // 3. Container & Background (Full CSS Linear Gradient support matching Member List / Settings Preview)
        val padH = (6 * density).toInt()
        val padV = (2 * density).toInt()
        val cornerRad = 4f * density

        if (tag.gradientColors != null && tag.gradientColors.size >= 2) {
            val orientation = when (tag.gradientOrientation) {
                "TL_BR" -> GradientDrawable.Orientation.TL_BR
                "BL_TR" -> GradientDrawable.Orientation.BL_TR
                "TOP_BOTTOM" -> GradientDrawable.Orientation.TOP_BOTTOM
                "BOTTOM_TOP" -> GradientDrawable.Orientation.BOTTOM_TOP
                "RIGHT_LEFT" -> GradientDrawable.Orientation.RIGHT_LEFT
                "TR_BL" -> GradientDrawable.Orientation.TR_BL
                "BR_TL" -> GradientDrawable.Orientation.BR_TL
                else -> GradientDrawable.Orientation.LEFT_RIGHT
            }
            val gd = GradientDrawable(orientation, tag.gradientColors).apply {
                cornerRadius = cornerRad
            }
            chiplet.background = gd
            chiplet.setPadding(padH, padV, padH, padV)
            if (chiplet !== tagTextView) {
                tagTextView.background = null
                tagTextView.setPadding(0, 0, 0, 0)
            }
        } else if (tag.backgroundColor != null) {
            val gd = GradientDrawable().apply {
                setColor(tag.backgroundColor)
                cornerRadius = cornerRad
            }
            chiplet.background = gd
            chiplet.setPadding(padH, padV, padH, padV)
            if (chiplet !== tagTextView) {
                tagTextView.background = null
                tagTextView.setPadding(0, 0, 0, 0)
            }
        }
    }

    private fun resolveEnumConstant(assetClass: Class<*>, iconName: String): Any? {
        val exact = runCatching {
            @Suppress("UNCHECKED_CAST")
            java.lang.Enum.valueOf(assetClass as Class<out Enum<*>>, iconName)
        }.getOrNull()
        if (exact != null) return exact

        val candidates = assetClass.enumConstants ?: return null
        for (c in candidates) {
            val name = (c as? Enum<*>)?.name ?: continue
            if (name.equals(iconName, ignoreCase = true) ||
                name.replace("_", "").equals(iconName.replace("_", ""), ignoreCase = true)
            ) {
                return c
            }
        }
        return null
    }

    private fun loadFallbackDrawable(context: Context, iconName: String, assetUri: String? = null): Drawable? {
        val res = context.resources
        val snake = iconName.replace(Regex("(?<=[a-z])(?=[A-Z])"), "_").lowercase()
        val lower = iconName.lowercase()
        val candidates = mutableListOf<String>()
        if (!assetUri.isNullOrBlank()) {
            candidates.add(assetUri)
        }
        candidates.add("design_components_icon_native_redesign_generated_images_$lower")
        candidates.add("design_components_icon_native_redesign_generated_images_$snake")
        candidates.add(iconName)
        candidates.add(snake)
        candidates.add(lower)
        candidates.add(snake.removeSuffix("_icon"))
        candidates.add(lower.removeSuffix("_icon"))
        candidates.add("ic_$snake")
        candidates.add("ic_${snake.removeSuffix("_icon")}")

        val pkgs = listOfNotNull(context.packageName, context.applicationInfo?.packageName, "com.discord", "app.valenced").distinct()
        for (pkg in pkgs) {
            for (name in candidates) {
                val id = res.getIdentifier(name, "drawable", pkg)
                if (id != 0) {
                    val d = runCatching { context.getDrawable(id) }.getOrNull()
                    if (d != null) return d
                }
            }
        }

        for (name in candidates) {
            val stream = runCatching { context.assets.open("$name.png") }.getOrNull()
                ?: runCatching { context.assets.open(name) }.getOrNull()
                ?: runCatching { context.assets.open("drawable/$name.png") }.getOrNull()
            if (stream != null) {
                val d = runCatching { Drawable.createFromStream(stream, name) }.getOrNull()
                if (d != null) return d
            }
        }
        return null
    }

    private fun findTagTextView(header: ViewGroup, ids: ViewIds, expectedText: String?): TextView? {
        val cleanExpected = expectedText?.trim()
        val authorNameView = if (ids.authorName != 0) header.findViewById<View>(ids.authorName) else null

        // 1. Recursive search for a TextView whose text contains expectedText
        if (!cleanExpected.isNullOrEmpty()) {
            val tv = findTextViewMatching(header, authorNameView, cleanExpected)
            if (tv != null) return tv
        }

        // 2. Search chiplets if visible
        for (chipletId in ids.chiplets) {
            if (chipletId != 0) {
                val chiplet = header.findViewById<View>(chipletId)
                if (chiplet != null && chiplet.visibility == View.VISIBLE) {
                    val tv = (chiplet as? TextView) ?: (if (ids.tag != 0) chiplet.findViewById(ids.tag) else null)
                    if (tv != null) return tv
                }
            }
        }

        // 3. Fallback to tag id if visible
        if (ids.tag != 0) {
            val tv = header.findViewById<TextView>(ids.tag)
            if (tv != null && tv.visibility == View.VISIBLE) return tv
        }

        return null
    }

    private fun findTextViewMatching(parent: ViewGroup, excludeView: View?, text: String): TextView? {
        for (i in 0 until parent.childCount) {
            val child = parent.getChildAt(i)
            if (child === excludeView) continue
            if (child is TextView) {
                val childText = child.text?.toString() ?: ""
                if (childText.contains(text, ignoreCase = true)) {
                    return child
                }
            } else if (child is ViewGroup) {
                val nested = findTextViewMatching(child, excludeView, text)
                if (nested != null) return nested
            }
        }
        return null
    }

    private fun findChipletContainer(header: ViewGroup, ids: ViewIds, tagTextView: TextView): View {
        val parent = tagTextView.parent
        return if (parent is ViewGroup && parent !== header) parent else tagTextView
    }
}

private class ViewIds(view: View) {
    val header = view.idOf("header")
    val authorName = view.idOf("author_name")
    val tag = view.idOf("tag")
    val chiplets = listOf(
        view.idOf("clan_tag_chiplet"),
        view.idOf("role_tag_chiplet"),
        view.idOf("server_tag_chiplet"),
        view.idOf("author_tag_chiplet"),
        view.idOf("tag_chiplet"),
        view.idOf("bot_tag"),
    )
}

private fun View.idOf(name: String): Int =
    context.resources.getIdentifier(name, "id", context.packageName)

private fun ViewGroup.childWithId(id: Int): View? =
    (0 until childCount).firstNotNullOfOrNull { index -> getChildAt(index).takeIf { it.id == id } }

val staffTags = plugin {
    var hooks: TagHooks? = null

    start {
        hooks = TagHooks(dexFinder)

        registerNativeMethod("hieuxyz.stafftags.putTags") { rawArgs ->
            val args = rawArgs.asDelegate()
            val json: String by args.string()
            hooks?.put(json)
            null
        }

        registerNativeMethod("hieuxyz.stafftags.clearTags") {
            hooks?.clear()
            null
        }
    }

    stop {
        hooks?.dispose()
        hooks = null
    }
}
