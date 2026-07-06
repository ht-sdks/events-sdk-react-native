package com.hightouchanalyticsreactnative

import android.app.Activity
import android.content.Intent
import android.content.pm.PackageInfo
import android.net.Uri
import com.facebook.react.bridge.ReactApplicationContext
import com.htsovranreactnative.SovranModule
import com.nhaarman.mockitokotlin2.any
import com.nhaarman.mockitokotlin2.argumentCaptor
import com.nhaarman.mockitokotlin2.eq
import com.nhaarman.mockitokotlin2.mock
import com.nhaarman.mockitokotlin2.verify
import com.nhaarman.mockitokotlin2.whenever
import org.junit.Assert.assertEquals
import org.junit.Before
import org.junit.Test
import org.junit.runner.RunWith
import org.robolectric.RobolectricTestRunner
import org.robolectric.annotation.Config

@RunWith(RobolectricTestRunner::class)
@Config(sdk = [28])
class AnalyticsReactNativeModuleTest {
  private lateinit var reactContext: ReactApplicationContext
  private lateinit var sovranModule: SovranModule
  private lateinit var activity: Activity
  private lateinit var module: AnalyticsReactNativeModule

  @Before
  fun setUp() {
    reactContext = mock()
    sovranModule = mock()
    activity = mock()

    val packageManager = mock<android.content.pm.PackageManager>()
    val packageInfo =
      PackageInfo().apply {
        versionName = "1.0"
        versionCode = 1
      }

    whenever(reactContext.packageManager).thenReturn(packageManager)
    whenever(reactContext.packageName).thenReturn("com.test.app")
    whenever(packageManager.getPackageInfo(eq("com.test.app"), eq(0))).thenReturn(packageInfo)
    whenever(reactContext.currentActivity).thenReturn(activity)
    whenever(reactContext.getNativeModule(SovranModule::class.java)).thenReturn(sovranModule)

    module = AnalyticsReactNativeModule(reactContext)
  }

  @Test
  fun onNewIntent_dispatchesDeepLinkDataViaReactApplicationContext() {
    val uri = Uri.parse("hightouchreactnative://hello?foo=bar")
    val intent = Intent(Intent.ACTION_VIEW, uri)

    module.onNewIntent(intent)

    val payloadCaptor = argumentCaptor<Map<String, Any?>>()
    verify(sovranModule).dispatch(eq("add-deepLink-data"), payloadCaptor.capture())
    assertEquals("hightouchreactnative://hello?foo=bar", payloadCaptor.firstValue["url"])
    assertEquals("bar", payloadCaptor.firstValue["foo"])
    verify(reactContext).getNativeModule(SovranModule::class.java)
  }

  @Test
  fun onNewIntent_doesNotThrowWhenReactInstanceManagerIsUnavailable() {
    val uri = Uri.parse("hightouchreactnative://hello")
    val intent = Intent(Intent.ACTION_VIEW, uri)

    module.onNewIntent(intent)

    verify(sovranModule).dispatch(eq("add-deepLink-data"), any())
  }
}
