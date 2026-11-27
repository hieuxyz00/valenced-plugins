@file:JvmName("HieuxyzLib")

package hieuxyz.lib

import android.app.Activity
import android.content.Intent
import android.net.Uri
import android.util.Base64
import app.valenced.bridge.asDelegate
import app.valenced.plugins.plugin
import app.valenced.xposed.api.registerNativeAsyncMethod
import app.valenced.xposed.api.registerNativeMethod
import de.robv.android.xposed.XC_MethodHook
import de.robv.android.xposed.XposedBridge
import kotlinx.coroutines.CancellableContinuation
import kotlinx.coroutines.suspendCancellableCoroutine
import java.io.File
import kotlin.coroutines.resumeWithException

private const val SAF_SAVE_REQUEST_CODE = 44782
private const val SAF_PICK_REQUEST_CODE = 44783

val hieuxyzLib = plugin {
	val pickerLock = Any()
	var pendingPicker: CancellableContinuation<Pair<Activity, Uri>?>? = null
	var pendingRequestCode: Int? = null
	var onActivityResultHook: XC_MethodHook.Unhook? = null

	start {
		runCatching {
			val method = Activity::class.java.getDeclaredMethod(
				"onActivityResult",
				Int::class.javaPrimitiveType,
				Int::class.javaPrimitiveType,
				Intent::class.java,
			).apply { isAccessible = true }

			onActivityResultHook = XposedBridge.hookMethod(
				method,
				object : XC_MethodHook() {
					override fun afterHookedMethod(param: MethodHookParam) {
						val requestCode = param.args.getOrNull(0) as? Int ?: return
						val continuation = synchronized(pickerLock) {
							if (pendingRequestCode != requestCode) {
								return@afterHookedMethod
							}
							pendingRequestCode = null
							pendingPicker.also { pendingPicker = null }
						} ?: return
						if (!continuation.isActive) return

						val resultCode = param.args.getOrNull(1) as? Int
						val uri = (param.args.getOrNull(2) as? Intent)?.data
						val activity = param.thisObject as? Activity
						val result =
							if (resultCode == Activity.RESULT_OK && uri != null && activity != null) {
								activity to uri
							} else {
								null
							}
						continuation.resumeWith(Result.success(result))
					}
				},
			)
		}

		suspend fun launchSafPicker(
			requestCode: Int,
			intent: Intent,
		): Pair<Activity, Uri>? = suspendCancellableCoroutine { continuation ->
			synchronized(pickerLock) {
				check(pendingPicker == null) {
					"Another file picker is already active"
				}
				pendingPicker = continuation
				pendingRequestCode = requestCode
			}

			continuation.invokeOnCancellation {
				synchronized(pickerLock) {
					if (pendingPicker === continuation) {
						pendingPicker = null
						pendingRequestCode = null
					}
				}
			}

			withAppActivity { activity ->
				activity.runOnUiThread {
					if (!continuation.isActive) return@runOnUiThread
					try {
						activity.startActivityForResult(intent, requestCode)
					} catch (error: Throwable) {
						synchronized(pickerLock) {
							if (pendingPicker === continuation) {
								pendingPicker = null
								pendingRequestCode = null
							}
						}
						if (continuation.isActive) {
							continuation.resumeWithException(error)
						}
					}
				}
			}
		}

		registerNativeAsyncMethod("hieuxyz.lib.saveViaSaf") { rawArgs ->
			val args = rawArgs.asDelegate()
			val fileName: String by args.string()
			val mimeType: String by args.string()
			val content: String by args.string()

			val intent = Intent(Intent.ACTION_CREATE_DOCUMENT).apply {
				addCategory(Intent.CATEGORY_OPENABLE)
				type = mimeType
				putExtra(Intent.EXTRA_TITLE, fileName)
			}

			val destination = launchSafPicker(SAF_SAVE_REQUEST_CODE, intent)
				?: return@registerNativeAsyncMethod false

			val (activity, uri) = destination
			val output = checkNotNull(
				activity.contentResolver.openOutputStream(uri, "wt"),
			) {
				"Unable to open destination file"
			}
			output.bufferedWriter(Charsets.UTF_8).use { it.write(content) }
			true
		}

		registerNativeAsyncMethod("hieuxyz.lib.pickViaSaf") { rawArgs ->
			val args = rawArgs.asDelegate()
			val mimeType: String by args.string()

			val intent = Intent(Intent.ACTION_OPEN_DOCUMENT).apply {
				addCategory(Intent.CATEGORY_OPENABLE)
				type = mimeType
			}

			val selection = launchSafPicker(SAF_PICK_REQUEST_CODE, intent)
				?: return@registerNativeAsyncMethod null

			val (activity, uri) = selection
			val input = checkNotNull(
				activity.contentResolver.openInputStream(uri),
			) {
				"Unable to open selected file"
			}
			input.bufferedReader(Charsets.UTF_8).use { it.readText() }
		}

		registerNativeMethod("hieuxyz.lib.readFileBase64") { rawArgs ->
			val args = rawArgs.asDelegate()
			val path: String by args.string()
			val file = File(path)
			if (!file.isFile) {
				return@registerNativeMethod null
			}
			val bytes = file.readBytes()
			Base64.encodeToString(bytes, Base64.NO_WRAP)
		}

		registerNativeMethod("hieuxyz.lib.writeFileBase64") { rawArgs ->
			val args = rawArgs.asDelegate()
			val path: String by args.string()
			val base64: String by args.string()
			val bytes = Base64.decode(base64, Base64.DEFAULT)
			val file = File(path)
			file.parentFile?.mkdirs()
			file.writeBytes(bytes)
			true
		}
	}

	stop {
		onActivityResultHook?.unhook()
		onActivityResultHook = null
		synchronized(pickerLock) {
			pendingRequestCode = null
			pendingPicker.also { pendingPicker = null }
		}?.cancel()
	}
}
