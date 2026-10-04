package app.connection.mobile;

import android.Manifest;
import android.app.*;
import android.content.*;
import android.content.pm.PackageManager;
import android.net.Uri;
import android.os.*;
import android.view.*;
import android.webkit.*;
import android.widget.*;
import androidx.webkit.*;
import org.json.*;
import java.util.Set;

public final class MainActivity extends Activity {
    private WebView web;
    private JavaScriptReplyProxy reply;
    private JSONObject pending;
    private String pendingId, startingId;
    private boolean foreground;
    private static boolean trusted(Uri uri) {
        return uri != null && "https".equals(uri.getScheme()) && "connection-gray-sigma.vercel.app".equals(uri.getHost()) && (uri.getPort() == -1 || uri.getPort() == 443);
    }
    @Override public void onCreate(Bundle state) {
        super.onCreate(state);
        LinearLayout root = new LinearLayout(this); root.setOrientation(LinearLayout.VERTICAL);
        root.setOnApplyWindowInsetsListener((v, insets) -> {
            if (Build.VERSION.SDK_INT >= 30) { var bars = insets.getInsets(WindowInsets.Type.systemBars() | WindowInsets.Type.ime()); v.setPadding(bars.left, bars.top, bars.right, bars.bottom); }
            else v.setPadding(insets.getSystemWindowInsetLeft(), insets.getSystemWindowInsetTop(), insets.getSystemWindowInsetRight(), insets.getSystemWindowInsetBottom());
            return insets;
        });
        LinearLayout toolbar = new LinearLayout(this);
        Button invite = new Button(this); invite.setText("초대 링크 열기"); invite.setOnClickListener(v -> openInvite());
        Button stop = new Button(this); stop.setText("공유 중지"); stop.setOnClickListener(v -> stopSharing());
        toolbar.addView(invite, new LinearLayout.LayoutParams(0, dp(48), 1)); toolbar.addView(stop, new LinearLayout.LayoutParams(0, dp(48), 1)); root.addView(toolbar);
        web = new WebView(this);
        web.getSettings().setJavaScriptEnabled(true); web.getSettings().setDomStorageEnabled(true);
        web.getSettings().setAllowFileAccess(false); web.getSettings().setAllowContentAccess(false);
        web.getSettings().setMixedContentMode(WebSettings.MIXED_CONTENT_NEVER_ALLOW);
        web.getSettings().setGeolocationEnabled(false);
        web.setWebChromeClient(new WebChromeClient() {
            @Override public boolean onJsConfirm(WebView view, String url, String message, JsResult result) {
                new AlertDialog.Builder(MainActivity.this).setMessage(message).setPositiveButton("확인", (d,w) -> result.confirm()).setNegativeButton("취소", (d,w) -> result.cancel()).setOnCancelListener(d -> result.cancel()).show(); return true;
            }
        });
        web.setWebViewClient(new WebViewClient() {
            @Override public boolean shouldOverrideUrlLoading(WebView view, WebResourceRequest request) {
                if (!request.isForMainFrame()) return false;
                if (trusted(request.getUrl())) return false;
                if (request.hasGesture() && "https".equals(request.getUrl().getScheme())) {
                    try { startActivity(new Intent(Intent.ACTION_VIEW, request.getUrl())); } catch (ActivityNotFoundException ignored) {}
                }
                return true;
            }
            @Override public void onPageStarted(WebView view, String url, android.graphics.Bitmap favicon) { reply = null; }
            @Override public void onReceivedError(WebView view, WebResourceRequest request, WebResourceError error) {
                if (request.isForMainFrame() && foreground) new AlertDialog.Builder(MainActivity.this).setTitle("인터넷 연결 확인").setMessage("화면을 불러오지 못했습니다. 위쪽 버튼으로 공유를 중지할 수 있습니다.")
                    .setPositiveButton("다시 시도", (d,w) -> web.loadUrl(LocationService.ORIGIN)).setNegativeButton("닫기", null).show();
            }
        });
        if (WebViewFeature.isFeatureSupported(WebViewFeature.WEB_MESSAGE_LISTENER)) {
            WebViewCompat.addWebMessageListener(web, "ConnectionNative", Set.of(LocationService.ORIGIN), (view, message, sourceOrigin, isMainFrame, proxy) -> {
                if (!isMainFrame || !trusted(sourceOrigin) || !trusted(Uri.parse(view.getUrl()))) return;
                reply = proxy;
                try { receive(new JSONObject(message.getData())); } catch (Exception ignored) {}
            });
        } else {
            new AlertDialog.Builder(this).setMessage("Android System WebView를 업데이트한 뒤 다시 실행해주세요.").setPositiveButton("확인", (d,w) -> finish()).show();
        }
        root.addView(web, new LinearLayout.LayoutParams(-1, 0, 1)); setContentView(root);
        LocationService.observer = () -> {
            String id = startingId; startingId = null;
            send(id, id == null || LocationService.active, LocationService.statusError);
        };
        web.loadUrl(LocationService.ORIGIN);
    }
    private int dp(int value) { return Math.round(value * getResources().getDisplayMetrics().density); }
    private void receive(JSONObject message) throws JSONException {
        String id = message.getString("id");
        switch (message.optString("action")) {
            case "status": send(id, true, null); break;
            case "stop": stopSharing(); send(id, true, null); break;
            case "start":
                JSONObject next = message.optJSONObject("session");
                if (!foreground || !LocationService.valid(next)) { send(id, false, "앱 화면에서 공유를 다시 켜주세요."); return; }
                pending = next; pendingId = id;
                if (checkSelfPermission(Manifest.permission.ACCESS_FINE_LOCATION) != PackageManager.PERMISSION_GRANTED && checkSelfPermission(Manifest.permission.ACCESS_COARSE_LOCATION) != PackageManager.PERMISSION_GRANTED) {
                    requestPermissions(new String[]{ Manifest.permission.ACCESS_FINE_LOCATION, Manifest.permission.ACCESS_COARSE_LOCATION }, 1);
                } else requestNotificationOrStart();
                break;
            default: send(id, false, "지원하지 않는 요청입니다.");
        }
    }
    private void requestNotificationOrStart() {
        if (Build.VERSION.SDK_INT >= 33 && checkSelfPermission(Manifest.permission.POST_NOTIFICATIONS) != PackageManager.PERMISSION_GRANTED) requestPermissions(new String[]{Manifest.permission.POST_NOTIFICATIONS}, 2);
        else startSharing();
    }
    private void startSharing() {
        if (pending == null) return;
        if (!foreground) { LocationService.revoke(pending); send(pendingId, false, "앱 화면에서 공유를 다시 켜주세요."); pending = null; pendingId = null; return; }
        startingId = pendingId;
        startForegroundService(new Intent(this, LocationService.class).setAction("start").putExtra("session", pending.toString()));
        pending = null; pendingId = null;
    }
    private void stopSharing() {
        if (pending != null) { LocationService.revoke(pending); send(pendingId, false, "공유 요청이 취소되었습니다."); pending = null; pendingId = null; }
        if (LocationService.active || startingId != null) startService(new Intent(this, LocationService.class).setAction("stop"));
    }
    @Override public void onRequestPermissionsResult(int request, String[] permissions, int[] results) {
        super.onRequestPermissionsResult(request, permissions, results);
        if (pending == null) return;
        if (request == 1) {
            if (checkSelfPermission(Manifest.permission.ACCESS_COARSE_LOCATION) == PackageManager.PERMISSION_GRANTED || checkSelfPermission(Manifest.permission.ACCESS_FINE_LOCATION) == PackageManager.PERMISSION_GRANTED) requestNotificationOrStart();
            else { LocationService.revoke(pending); send(pendingId, false, "위치 권한을 허용해주세요."); pending = null; pendingId = null; }
        } else if (request == 2) startSharing();
    }
    private void send(String id, boolean ok, String error) {
        if (reply == null || !trusted(Uri.parse(web.getUrl() == null ? "" : web.getUrl()))) return;
        JSONObject value = LocationService.state();
        try { if (id != null) value.put("id", id); value.put("ok", ok); if (error != null) value.put("error", error); reply.postMessage(value.toString()); } catch (Exception ignored) {}
    }
    private void openInvite() {
        EditText input = new EditText(this); input.setInputType(android.text.InputType.TYPE_CLASS_TEXT | android.text.InputType.TYPE_TEXT_VARIATION_URI); input.setHint(LocationService.ORIGIN + "/room/…");
        new AlertDialog.Builder(this).setTitle("받은 초대 링크를 붙여넣으세요").setView(input).setNegativeButton("취소", null).setPositiveButton("열기", (d,w) -> {
            Uri uri = Uri.parse(input.getText().toString().trim());
            if (trusted(uri) && uri.getPath() != null && uri.getPath().matches("/room/[A-Za-z0-9_-]{8,64}")) web.loadUrl(uri.toString());
            else Toast.makeText(this, "Connection 초대 링크를 확인해주세요.", Toast.LENGTH_LONG).show();
        }).show();
    }
    @Override protected void onResume() { super.onResume(); foreground = true; if(web != null) web.onResume(); send(null, true, null); }
    @Override protected void onPause() { foreground = false; super.onPause(); if(web != null) web.onPause(); }
    @Override protected void onDestroy() { LocationService.observer = null; reply = null; if(web != null) web.destroy(); super.onDestroy(); }
}
