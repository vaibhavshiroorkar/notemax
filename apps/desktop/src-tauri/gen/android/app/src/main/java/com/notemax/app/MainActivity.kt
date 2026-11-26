package com.notemax.app

import android.content.Intent
import android.net.Uri
import android.os.Bundle
import androidx.activity.OnBackPressedCallback
import androidx.activity.enableEdgeToEdge

class MainActivity : TauriActivity() {
  override fun onCreate(savedInstanceState: Bundle?) {
    enableEdgeToEdge()
    // Before super, so the deep-link plugin finds the share link when it loads.
    intent = asLink(intent)
    // Added first, so it runs last: when the app has no page to go back to
    // (features/phone/back.ts), Back puts the app away as Android does. Tauri
    // would finish the activity, which ends the app, so the next open is a cold start.
    onBackPressedDispatcher.addCallback(this, object : OnBackPressedCallback(true) {
      override fun handleOnBackPressed() {
        moveTaskToBack(true)
      }
    })
    super.onCreate(savedInstanceState)
  }

  override fun onNewIntent(intent: Intent) {
    val link = asLink(intent)
    setIntent(link)
    super.onNewIntent(link)
  }

  /**
   * The deep-link plugin hears only links, so text shared from another app
   * becomes notemax://open/share?text=...&subject=..., which
   * apps/app/src/features/phone/links.ts saves as a note.
   */
  private fun asLink(intent: Intent): Intent {
    if (intent.action != Intent.ACTION_SEND || intent.type?.startsWith("text/") != true) return intent
    val text = intent.getCharSequenceExtra(Intent.EXTRA_TEXT)?.toString() ?: return intent
    val link = Uri.Builder().scheme("notemax").authority("open").path("share")
      .appendQueryParameter("text", text)
      .appendQueryParameter("subject", intent.getStringExtra(Intent.EXTRA_SUBJECT) ?: "")
      .build()
    return Intent(Intent.ACTION_VIEW, link)
  }
}
