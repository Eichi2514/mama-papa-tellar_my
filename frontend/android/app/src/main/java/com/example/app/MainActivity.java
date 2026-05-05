package com.example.app;

import android.os.Bundle;
import android.media.AudioAttributes;
import android.media.AudioManager;
import android.content.Context;
import com.getcapacitor.BridgeActivity;

public class MainActivity extends BridgeActivity {

    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);

        // Android 10 (API 29) 이상에서만 동작하도록 분기 처리
        if (android.os.Build.VERSION.SDK_INT >= android.os.Build.VERSION_CODES.Q) {
            try {
                AudioManager audioManager = (AudioManager) getSystemService(Context.AUDIO_SERVICE);
                if (audioManager != null) {
                    // 시스템 전체에서 우리 앱의 소리를 캡처(공유)할 수 있도록 전면 허용
                    audioManager.setAllowedCapturePolicy(AudioAttributes.ALLOW_CAPTURE_BY_ALL);
                }
            } catch (Exception e) {
                // 실서비스 운영 시 앱이 죽는(Crash) 현상을 방지하기 위한 예외 처리
                e.printStackTrace();
            }
        }
    }
}