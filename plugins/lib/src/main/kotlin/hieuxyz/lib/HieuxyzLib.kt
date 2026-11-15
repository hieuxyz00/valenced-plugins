@file:JvmName("HieuxyzLib")

package hieuxyz.lib

import android.app.Activity
import android.content.Intent
import android.net.Uri
import android.widget.Toast
import app.valenced.bridge.asDelegate
import app.valenced.plugins.plugin
import app.valenced.xposed.api.registerNativeMethod
import de.robv.android.xposed.XC_MethodHook
import de.robv.android.xposed.XposedBridge
import java.lang.reflect.Method

private const val SAF_REQUEST_CODE = 44782

val hieuxyzLib = plugin {
    var pendingContent: String? = null
    var onActivityResultHook: XC_MethodHook.Unhook? = null

    start {
        runCatching {
            val method: Method = Activity::class.java.getDeclaredMethod(
                "onActivityResult",
                Int::class.javaPrimitiveType,
                Int::class.javaPrimitiveType,
                Intent::class.java,
            ).apply { isAccessible = true }

            onActivityResultHook = XposedBridge.hookMethod(method, object : XC_MethodHook() {
                override fun afterHookedMethod(param: MethodHookParam) {
                    val requestCode = param.args[0] as? Int ?: return
                    if (requestCode != SAF_REQUEST_CODE) return

                    val resultCode = param.args[1] as? Int ?: return
                    val data = param.args[2] as? Intent
                    val uri: Uri? = data?.data
                    val content = pendingContent
                    pendingContent = null

                    val activity = param.thisObject as? Activity ?: return

                    if (resultCode == Activity.RESULT_OK && uri != null && content != null) {
                        runCatching {
                            activity.contentResolver.openOutputStream(uri)?.use { os ->
                                os.write(content.toByteArray(Charsets.UTF_8))
                                os.flush()
                            }
                            activity.runOnUiThread {
                                Toast.makeText(activity, "File saved successfully!", Toast.LENGTH_SHORT).show()
                            }
                        }.onFailure { err ->
                            activity.runOnUiThread {
                                Toast.makeText(activity, "Save failed: ${err.message}", Toast.LENGTH_LONG).show()
                            }
                        }
                    }
                }
            })
        }

        registerNativeMethod("hieuxyz.lib.saveViaSaf") { rawArgs ->
            val args = rawArgs.asDelegate()
            val fileName: String by args.string()
            val mimeType: String by args.string()
            val content: String by args.string()

            pendingContent = content

            withAppActivity { activity ->
                val intent = Intent(Intent.ACTION_CREATE_DOCUMENT).apply {
                    addCategory(Intent.CATEGORY_OPENABLE)
                    type = mimeType
                    putExtra(Intent.EXTRA_TITLE, fileName)
                }
                activity.startActivityForResult(intent, SAF_REQUEST_CODE)
            }
            true
        }
    }

    stop {
        onActivityResultHook?.unhook()
        onActivityResultHook = null
        pendingContent = null
    }
}
