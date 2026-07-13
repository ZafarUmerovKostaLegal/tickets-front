package uz.kostalegal.tickets

import android.os.Bundle
import android.view.View
import android.view.ViewGroup
import android.webkit.WebView
import androidx.activity.enableEdgeToEdge
import androidx.core.view.ViewCompat
import androidx.core.view.WindowInsetsCompat

class MainActivity : TauriActivity() {
  override fun onCreate(savedInstanceState: Bundle?) {
    enableEdgeToEdge()
    super.onCreate(savedInstanceState)
    setupSafeAreaInjection()
  }

  private fun setupSafeAreaInjection() {
    val decor = window.decorView
    ViewCompat.setOnApplyWindowInsetsListener(decor) { _, windowInsets ->
      val bars = windowInsets.getInsets(WindowInsetsCompat.Type.systemBars())
      val cutout = windowInsets.getInsets(WindowInsetsCompat.Type.displayCutout())
      injectSafeAreaInsets(
        maxOf(bars.top, cutout.top),
        maxOf(bars.right, cutout.right),
        maxOf(bars.bottom, cutout.bottom),
        maxOf(bars.left, cutout.left),
      )
      windowInsets
    }
    ViewCompat.requestApplyInsets(decor)
  }

  private fun injectSafeAreaInsets(top: Int, right: Int, bottom: Int, left: Int) {
    val script =
      """
      (function(t,r,b,l){
        var root=document.documentElement;
        root.style.setProperty('--app-safe-top-js',t+'px');
        root.style.setProperty('--app-safe-right-js',r+'px');
        root.style.setProperty('--app-safe-bottom-js',b+'px');
        root.style.setProperty('--app-safe-left-js',l+'px');
        window.dispatchEvent(new Event('app-safe-area-insets'));
      })($top,$right,$bottom,$left);
      """.trimIndent()

    fun tryInject(attempt: Int) {
      val webView = findWebView(window.decorView)
      if (webView != null) {
        webView.evaluateJavascript(script, null)
      } else if (attempt < 12) {
        window.decorView.postDelayed({ tryInject(attempt + 1) }, 50L * (attempt + 1))
      }
    }

    tryInject(0)
  }

  private fun findWebView(view: View): WebView? {
    if (view is WebView) return view
    if (view is ViewGroup) {
      for (i in 0 until view.childCount) {
        findWebView(view.getChildAt(i))?.let { return it }
      }
    }
    return null
  }
}
