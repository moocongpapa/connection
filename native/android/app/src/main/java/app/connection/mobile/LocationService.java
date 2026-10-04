package app.connection.mobile;

import android.Manifest;
import android.app.*;
import android.content.*;
import android.content.pm.PackageManager;
import android.content.pm.ServiceInfo;
import android.location.*;
import android.os.*;
import org.json.*;
import java.net.*;
import javax.net.ssl.HttpsURLConnection;
import java.nio.charset.StandardCharsets;
import java.util.concurrent.*;

public final class LocationService extends Service implements LocationListener {
    static final String ORIGIN = "https://connection-gray-sigma.vercel.app";
    static JSONObject session, latest;
    static String statusError;
    static boolean active;
    interface Observer { void changed(); }
    static Observer observer;
    private static final ExecutorService uploads = Executors.newSingleThreadExecutor();
    private final Handler handler = new Handler(Looper.getMainLooper());
    private LocationManager manager;
    private long lastUpload;
    private boolean uploading;
    private final Runnable expiry = new Runnable() {
        public void run() {
            if (session != null && session.optLong("expiresAt") <= System.currentTimeMillis()) stopSharing("공유 시간이 만료되었습니다. 다시 켜주세요.");
            else if (active) handler.postDelayed(this, 30_000);
        }
    };
    static boolean valid(JSONObject value) {
        return value != null && value.optString("roomId").matches("[A-Za-z0-9_-]{8,64}") &&
            value.optString("userId").matches("[A-Za-z0-9_-]{8,80}") && value.optString("uploadToken").matches("[A-Za-z0-9_-]{43}") &&
            value.optLong("expiresAt") > System.currentTimeMillis() && value.optLong("expiresAt") <= System.currentTimeMillis() + 8 * 3600_000L + 60_000;
    }
    static JSONObject state() {
        JSONObject value = new JSONObject();
        try {
            value.put("active", active);
            if (session != null) value.put("roomId", session.optString("roomId"));
            if (latest != null) value.put("location", latest);
            if (statusError != null) value.put("error", statusError);
        } catch (JSONException ignored) {}
        return value;
    }
    private static void notifyState() { if (observer != null) observer.changed(); }
    static void revoke(JSONObject grant) { if (grant != null) uploads.execute(() -> post("stop", grant)); }
    private static int post(String action, JSONObject body) {
        HttpsURLConnection connection = null;
        try {
            connection = (HttpsURLConnection) new URL(ORIGIN + "/api/native/" + action).openConnection();
            connection.setRequestMethod("POST"); connection.setConnectTimeout(15_000); connection.setReadTimeout(15_000);
            connection.setInstanceFollowRedirects(false); connection.setDoOutput(true);
            connection.setRequestProperty("Content-Type", "application/json");
            try (var stream = connection.getOutputStream()) { stream.write(body.toString().getBytes(StandardCharsets.UTF_8)); }
            return connection.getResponseCode();
        } catch (Exception ignored) { return 0; } finally { if (connection != null) connection.disconnect(); }
    }
    @Override public void onCreate() { super.onCreate(); manager = (LocationManager)getSystemService(LOCATION_SERVICE); }
    @Override public int onStartCommand(Intent intent, int flags, int startId) {
        if (intent == null || "stop".equals(intent.getAction())) { stopSharing("공유를 중지했습니다."); return START_NOT_STICKY; }
        JSONObject next;
        try { next = new JSONObject(intent.getStringExtra("session")); } catch (Exception e) { stopSelf(); return START_NOT_STICKY; }
        if (!valid(next)) { stopSelf(); return START_NOT_STICKY; }
        manager.removeUpdates(this); handler.removeCallbacks(expiry);
        session = next; latest = null; lastUpload = 0; uploading = false; statusError = null;
        NotificationManager notifications = getSystemService(NotificationManager.class);
        notifications.createNotificationChannel(new NotificationChannel("sharing", "위치 공유", NotificationManager.IMPORTANCE_LOW));
        PendingIntent open = PendingIntent.getActivity(this, 0, new Intent(this, MainActivity.class), PendingIntent.FLAG_IMMUTABLE | PendingIntent.FLAG_UPDATE_CURRENT);
        PendingIntent stop = PendingIntent.getService(this, 1, new Intent(this, LocationService.class).setAction("stop"), PendingIntent.FLAG_IMMUTABLE | PendingIntent.FLAG_UPDATE_CURRENT);
        Notification notice = new Notification.Builder(this, "sharing").setContentTitle("Connection 위치 공유 중")
            .setContentText("화면을 꺼도 약 2분 간격으로 전송합니다. 최대 8시간.").setSmallIcon(android.R.drawable.ic_menu_mylocation)
            .setContentIntent(open).setOngoing(true).addAction(new Notification.Action.Builder(null, "공유 중지", stop).build()).build();
        try {
            if (Build.VERSION.SDK_INT >= 29) startForeground(1, notice, ServiceInfo.FOREGROUND_SERVICE_TYPE_LOCATION); else startForeground(1, notice);
            boolean registered = false;
            if (checkSelfPermission(Manifest.permission.ACCESS_FINE_LOCATION) == PackageManager.PERMISSION_GRANTED && manager.isProviderEnabled(LocationManager.GPS_PROVIDER)) {
                manager.requestLocationUpdates(LocationManager.GPS_PROVIDER, 120_000, 50, this); registered = true;
            }
            if (manager.isProviderEnabled(LocationManager.NETWORK_PROVIDER)) { manager.requestLocationUpdates(LocationManager.NETWORK_PROVIDER, 120_000, 50, this); registered = true; }
            if (!registered) { stopSharing("기기의 위치 서비스를 켜주세요."); return START_NOT_STICKY; }
            active = true; handler.post(expiry); notifyState();
        } catch (SecurityException | IllegalStateException e) { stopSharing("앱 화면에서 위치 권한을 허용하고 공유를 다시 켜주세요."); }
        return START_NOT_STICKY;
    }
    @Override public void onLocationChanged(Location location) {
        if (!active || session == null || session.optLong("expiresAt") <= System.currentTimeMillis()) { if(active) stopSharing("공유 시간이 만료되었습니다."); return; }
        if (location.getAccuracy() < 0 || Math.abs(System.currentTimeMillis() - location.getTime()) > 60_000) return;
        try {
            JSONObject value = new JSONObject().put("lat", location.getLatitude()).put("lng", location.getLongitude()).put("accuracy", location.getAccuracy()).put("timestamp", location.getTime());
            latest = value; notifyState();
            long now = SystemClock.elapsedRealtime();
            if (uploading || (lastUpload != 0 && now - lastUpload < 120_000)) return;
            uploading = true; lastUpload = now;
            JSONObject captured = session;
            JSONObject body = new JSONObject(captured.toString()).put("location", value);
            uploads.execute(() -> {
                int status = post("location", body);
                handler.post(() -> {
                    if (session != captured) return;
                    uploading = false;
                    if (status == 403 || status == 410) stopSharing("공유 권한이 종료되었습니다. 다시 켜주세요.");
                });
            });
        } catch (JSONException ignored) {}
    }
    private void stopSharing(String reason) {
        JSONObject old = session; active = false; session = null; latest = null; statusError = reason;
        manager.removeUpdates(this); handler.removeCallbacks(expiry); revoke(old); notifyState(); stopForeground(STOP_FOREGROUND_REMOVE); stopSelf();
    }
    @Override public void onProviderDisabled(String provider) {
        if (!manager.isProviderEnabled(LocationManager.GPS_PROVIDER) && !manager.isProviderEnabled(LocationManager.NETWORK_PROVIDER)) stopSharing("위치 서비스가 꺼져 공유를 중지했습니다.");
    }
    @Override public void onProviderEnabled(String provider) {}
    @Override public void onStatusChanged(String provider, int status, Bundle extras) {}
    @Override public void onDestroy() { manager.removeUpdates(this); handler.removeCallbacks(expiry); active = false; session = null; latest = null; notifyState(); super.onDestroy(); }
    @Override public IBinder onBind(Intent intent) { return null; }
}
