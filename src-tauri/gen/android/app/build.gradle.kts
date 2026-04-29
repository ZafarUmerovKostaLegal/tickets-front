import com.android.build.api.dsl.ApplicationExtension
import java.util.Properties

plugins {
    id("com.android.application")
    id("org.jetbrains.kotlin.android")
    id("rust")
}

val tauriProperties = Properties().apply {
    val propFile = file("tauri.properties")
    if (propFile.exists()) {
        propFile.inputStream().use { load(it) }
    }
}

/**
 * Подпись release: если `../keystore.properties` (рядом с `settings.gradle`, см. .example) — свой keystore
 * (Play/внутренняя дистрибуция). Иначе подписываем тем же debug-ключом, иначе Gradle выдаёт
 * *-unsigned.apk, который на телефоне даёт «пакет недействителен / повреждён».
 */
val keystorePropertiesFile = rootProject.file("keystore.properties")
val keystoreForRelease = Properties()
if (keystorePropertiesFile.exists()) {
    keystorePropertiesFile.inputStream().use { keystoreForRelease.load(it) }
}

// androidx.activity:activity-ktx 1.10+ требует compileSdk ≥ 35 (checkAarMetadata).
// Локально: в Android Studio SDK Manager установите Android 15 (API 35) и build-tools 35.x.
android {
    compileSdk = 35
    namespace = "uz.kostalegal.tickets"
    defaultConfig {
        manifestPlaceholders["usesCleartextTraffic"] = "false"
        applicationId = "uz.kostalegal.tickets"
        minSdk = 24
        targetSdk = 35
        versionCode = tauriProperties.getProperty("tauri.android.versionCode", "1").toInt()
        versionName = tauriProperties.getProperty("tauri.android.versionName", "1.0")
    }
    signingConfigs {
        if (keystorePropertiesFile.exists()) {
            create("releaseUpload") {
                keyAlias = keystoreForRelease.getProperty("keyAlias")
                    ?: error("keystore.properties: keyAlias")
                val p = keystoreForRelease.getProperty("password")
                    ?: error("keystore.properties: password")
                keyPassword = p
                storePassword = p
                val path = keystoreForRelease.getProperty("storeFile")
                    ?: error("keystore.properties: storeFile (путь к .jks от каталога gen/android)")
                storeFile = rootProject.file(path)
            }
        }
    }
    buildTypes {
        getByName("debug") {
            manifestPlaceholders["usesCleartextTraffic"] = "true"
            isDebuggable = true
            isJniDebuggable = true
            isMinifyEnabled = false
            packaging {                jniLibs.keepDebugSymbols.add("*/arm64-v8a/*.so")
                jniLibs.keepDebugSymbols.add("*/armeabi-v7a/*.so")
                jniLibs.keepDebugSymbols.add("*/x86/*.so")
                jniLibs.keepDebugSymbols.add("*/x86_64/*.so")
            }
        }
        getByName("release") {
            isMinifyEnabled = true
            proguardFiles(
                *fileTree(".") { include("**/*.pro") }
                    .plus(getDefaultProguardFile("proguard-android-optimize.txt"))
                    .toList().toTypedArray()
            )
        }
    }
    kotlinOptions {
        jvmTarget = "1.8"
    }
    buildFeatures {
        buildConfig = true
    }
}

rust {
    rootDirRel = "../../../"
}

dependencies {
    implementation("androidx.webkit:webkit:1.14.0")
    implementation("androidx.appcompat:appcompat:1.7.1")
    implementation("androidx.activity:activity-ktx:1.10.1")
    implementation("com.google.android.material:material:1.12.0")
    testImplementation("junit:junit:4.13.2")
    androidTestImplementation("androidx.test.ext:junit:1.1.4")
    androidTestImplementation("androidx.test.espresso:espresso-core:3.5.0")
}

apply(from = "tauri.build.gradle.kts")

// После tauri.build.gradle, чтобы не потерять подпись release.
afterEvaluate {
    val ext = extensions.getByType<ApplicationExtension>()
    ext.buildTypes.getByName("release") {
        signingConfig = if (keystorePropertiesFile.exists()) {
            ext.signingConfigs.getByName("releaseUpload")
        }
        else {
            ext.signingConfigs.getByName("debug")
        }
    }
}