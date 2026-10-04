import UIKit
import WebKit
import CoreLocation

let serviceOrigin = "https://connection-gray-sigma.vercel.app"

@main
final class AppDelegate: UIResponder, UIApplicationDelegate {
    var window: UIWindow?
    func application(_ application: UIApplication, didFinishLaunchingWithOptions launchOptions: [UIApplication.LaunchOptionsKey: Any]?) -> Bool {
        let window = UIWindow(frame: UIScreen.main.bounds)
        window.rootViewController = ConnectionController()
        window.makeKeyAndVisible()
        self.window = window
        return true
    }
}

final class ConnectionController: UIViewController, WKScriptMessageHandler, WKNavigationDelegate, WKUIDelegate, CLLocationManagerDelegate {
    private var web: WKWebView!
    private let manager = CLLocationManager()
    private var session: [String: Any]?
    private var pendingStart: String?
    private var latest: [String: Any]?
    private var lastUpload = Date.distantPast
    private var uploading = false
    private var uploadTask: URLSessionDataTask?
    private var expiryTimer: Timer?
    private var statusError: String?
    private let network = URLSession(configuration: .ephemeral)

    override func viewDidLoad() {
        super.viewDidLoad()
        view.backgroundColor = .systemBackground
        let config = WKWebViewConfiguration()
        config.userContentController.add(self, name: "connectionNative")
        web = WKWebView(frame: .zero, configuration: config)
        web.navigationDelegate = self; web.uiDelegate = self
        web.translatesAutoresizingMaskIntoConstraints = false
        let bar = UIStackView(); bar.axis = .horizontal; bar.distribution = .fillEqually
        bar.translatesAutoresizingMaskIntoConstraints = false
        let invite = UIButton(type: .system); invite.setTitle("초대 링크 열기", for: .normal)
        invite.addTarget(self, action: #selector(openInvite), for: .touchUpInside)
        let stop = UIButton(type: .system); stop.setTitle("공유 중지", for: .normal)
        stop.addTarget(self, action: #selector(stopFromButton), for: .touchUpInside)
        bar.addArrangedSubview(invite); bar.addArrangedSubview(stop)
        view.addSubview(bar); view.addSubview(web)
        NSLayoutConstraint.activate([
            bar.topAnchor.constraint(equalTo: view.safeAreaLayoutGuide.topAnchor), bar.leadingAnchor.constraint(equalTo: view.leadingAnchor),
            bar.trailingAnchor.constraint(equalTo: view.trailingAnchor), bar.heightAnchor.constraint(equalToConstant: 44),
            web.topAnchor.constraint(equalTo: bar.bottomAnchor), web.leadingAnchor.constraint(equalTo: view.leadingAnchor),
            web.trailingAnchor.constraint(equalTo: view.trailingAnchor), web.bottomAnchor.constraint(equalTo: view.safeAreaLayoutGuide.bottomAnchor)
        ])
        manager.delegate = self
        manager.desiredAccuracy = kCLLocationAccuracyHundredMeters
        manager.distanceFilter = 50
        manager.activityType = .otherNavigation
        manager.pausesLocationUpdatesAutomatically = false
        manager.allowsBackgroundLocationUpdates = true
        manager.showsBackgroundLocationIndicator = true
        web.load(URLRequest(url: URL(string: serviceOrigin)!))
        NotificationCenter.default.addObserver(self, selector: #selector(resumed), name: UIApplication.didBecomeActiveNotification, object: nil)
    }

    @objc private func resumed() {
        if let session, expiry(session) <= Date().timeIntervalSince1970 * 1000 { stop(reason: "공유 시간이 만료되었습니다. 다시 켜주세요.") }
        send()
    }
    @objc private func stopFromButton() { stop(reason: "공유를 중지했습니다.") }
    @objc private func openInvite() {
        let alert = UIAlertController(title: "초대 링크", message: "받은 Connection 초대 링크를 붙여넣으세요.", preferredStyle: .alert)
        alert.addTextField { $0.placeholder = serviceOrigin + "/room/…"; $0.keyboardType = .URL; $0.autocapitalizationType = .none }
        alert.addAction(UIAlertAction(title: "취소", style: .cancel))
        alert.addAction(UIAlertAction(title: "열기", style: .default) { [weak self] _ in
            guard let self, let value = alert.textFields?.first?.text?.trimmingCharacters(in: .whitespacesAndNewlines),
                  let url = URL(string: value), self.trusted(url), url.path.range(of: "^/room/[A-Za-z0-9_-]{8,64}$", options: .regularExpression) != nil else { return }
            self.web.load(URLRequest(url: url))
        })
        present(alert, animated: true)
    }
    private func trusted(_ url: URL?) -> Bool { url?.scheme == "https" && url?.host == "connection-gray-sigma.vercel.app" && (url?.port == nil || url?.port == 443) }
    private func expiry(_ value: [String: Any]) -> Double { (value["expiresAt"] as? NSNumber)?.doubleValue ?? 0 }
    private func validSession(_ value: [String: Any]) -> Bool {
        func matches(_ key: String, _ pattern: String) -> Bool { (value[key] as? String)?.range(of: pattern, options: .regularExpression) != nil }
        return matches("roomId", "^[A-Za-z0-9_-]{8,64}$") && matches("userId", "^[A-Za-z0-9_-]{8,80}$") && matches("uploadToken", "^[A-Za-z0-9_-]{43}$") && expiry(value) > Date().timeIntervalSince1970 * 1000 && expiry(value) <= Date().addingTimeInterval(8 * 3600 + 60).timeIntervalSince1970 * 1000
    }
    func userContentController(_ userContentController: WKUserContentController, didReceive message: WKScriptMessage) {
        guard message.frameInfo.isMainFrame, message.frameInfo.securityOrigin.protocol == "https",
              message.frameInfo.securityOrigin.host == "connection-gray-sigma.vercel.app", trusted(web.url),
              let body = message.body as? [String: Any], let id = body["id"] as? String, let action = body["action"] as? String else { return }
        switch action {
        case "status": send(id: id)
        case "stop": stop(reason: nil); send(id: id)
        case "start":
            guard let next = body["session"] as? [String: Any], validSession(next), UIApplication.shared.applicationState == .active else {
                send(id: id, ok: false, error: "앱 화면에서 공유를 다시 켜주세요."); return
            }
            // The server has already rotated the previous grant. Do not revoke the new one.
            stopLocal(); session = next; pendingStart = id; statusError = nil
            if manager.authorizationStatus == .notDetermined { manager.requestWhenInUseAuthorization() }
            else { beginIfAuthorized() }
        default: send(id: id, ok: false, error: "지원하지 않는 요청입니다.")
        }
    }
    private func beginIfAuthorized() {
        guard session != nil else { return }
        switch manager.authorizationStatus {
        case .authorizedAlways, .authorizedWhenInUse:
            manager.startUpdatingLocation()
            if let id = pendingStart { pendingStart = nil; send(id: id) }
            expiryTimer?.invalidate()
            expiryTimer = Timer.scheduledTimer(withTimeInterval: 30, repeats: true) { [weak self] _ in self?.checkExpiry() }
        case .denied, .restricted:
            let id = pendingStart; pendingStart = nil
            stop(reason: "설정에서 Connection의 위치 권한을 허용해주세요.")
            if let id { send(id: id, ok: false, error: statusError) }
        default: break
        }
    }
    func locationManagerDidChangeAuthorization(_ manager: CLLocationManager) { beginIfAuthorized() }
    private func checkExpiry() { if let session, expiry(session) <= Date().timeIntervalSince1970 * 1000 { stop(reason: "8시간 공유가 종료되었습니다. 다시 켜주세요.") } }
    func locationManager(_ manager: CLLocationManager, didUpdateLocations locations: [CLLocation]) {
        checkExpiry()
        guard let session, let location = locations.last, location.horizontalAccuracy >= 0,
              abs(location.timestamp.timeIntervalSinceNow) < 60 else { return }
        let value: [String: Any] = ["lat": location.coordinate.latitude, "lng": location.coordinate.longitude,
            "accuracy": location.horizontalAccuracy, "timestamp": location.timestamp.timeIntervalSince1970 * 1000]
        latest = value; send()
        guard !uploading, Date().timeIntervalSince(lastUpload) >= 120 else { return }
        uploading = true; lastUpload = Date()
        var body = session; body["location"] = value
        uploadTask = post("location", body) { [weak self] code in
            guard let self, self.session?["uploadToken"] as? String == session["uploadToken"] as? String else { return }
            self.uploading = false
            if code == 403 || code == 410 { self.stop(reason: "공유 권한이 종료되었습니다. 앱에서 다시 켜주세요.") }
        }
    }
    func locationManager(_ manager: CLLocationManager, didFailWithError error: Error) {
        if (error as? CLError)?.code == .denied { stop(reason: "위치 권한이 꺼져 공유를 중지했습니다.") }
    }
    private func stopLocal() {
        manager.stopUpdatingLocation(); expiryTimer?.invalidate(); expiryTimer = nil
        uploadTask?.cancel(); uploadTask = nil; uploading = false; lastUpload = .distantPast; latest = nil
        if let id = pendingStart { pendingStart = nil; send(id: id, ok: false, error: "공유 요청이 취소되었습니다.") }
    }
    private func stop(reason: String?) {
        let old = session; session = nil; stopLocal(); statusError = reason
        if let old {
            var task: UIBackgroundTaskIdentifier = .invalid
            task = UIApplication.shared.beginBackgroundTask(withName: "Stop sharing") { if task != .invalid { UIApplication.shared.endBackgroundTask(task); task = .invalid } }
            _ = post("stop", old) { _ in if task != .invalid { UIApplication.shared.endBackgroundTask(task); task = .invalid } }
        }
        send()
    }
    @discardableResult private func post(_ action: String, _ body: [String: Any], completion: @escaping (Int) -> Void) -> URLSessionDataTask {
        var request = URLRequest(url: URL(string: serviceOrigin + "/api/native/" + action)!)
        request.httpMethod = "POST"; request.timeoutInterval = 20; request.setValue("application/json", forHTTPHeaderField: "Content-Type")
        request.httpBody = try? JSONSerialization.data(withJSONObject: body)
        let task = network.dataTask(with: request) { _, response, _ in
            let code = (response as? HTTPURLResponse)?.statusCode ?? 0
            DispatchQueue.main.async { completion(code) }
        }; task.resume(); return task
    }
    private func send(id: String? = nil, ok: Bool = true, error: String? = nil) {
        guard trusted(web?.url) else { return }
        var value: [String: Any] = ["active": session != nil && pendingStart == nil, "ok": ok]
        if let id { value["id"] = id }
        if let roomId = session?["roomId"] { value["roomId"] = roomId }
        if let latest { value["location"] = latest }
        if let error = error ?? statusError { value["error"] = error }
        guard let data = try? JSONSerialization.data(withJSONObject: value, options: [.fragmentsAllowed]), let json = String(data: data, encoding: .utf8) else { return }
        web.evaluateJavaScript("window.connectionNativeReceive?.(\(json))", completionHandler: nil)
    }
    func webView(_ webView: WKWebView, decidePolicyFor navigationAction: WKNavigationAction, decisionHandler: @escaping (WKNavigationActionPolicy) -> Void) {
        // Subframes need Google Maps, but only our own main frame gets the native bridge.
        if navigationAction.targetFrame?.isMainFrame == false { decisionHandler(.allow); return }
        if trusted(navigationAction.request.url) { decisionHandler(.allow); return }
        if navigationAction.navigationType == .linkActivated, let url = navigationAction.request.url, url.scheme == "https" { UIApplication.shared.open(url) }
        decisionHandler(.cancel)
    }
    func webView(_ webView: WKWebView, createWebViewWith configuration: WKWebViewConfiguration, for navigationAction: WKNavigationAction, windowFeatures: WKWindowFeatures) -> WKWebView? {
        if let url = navigationAction.request.url, url.scheme == "https" { UIApplication.shared.open(url) }; return nil
    }
    func webView(_ webView: WKWebView, runJavaScriptConfirmPanelWithMessage message: String, initiatedByFrame frame: WKFrameInfo, completionHandler: @escaping (Bool) -> Void) {
        let alert = UIAlertController(title: "Connection", message: message, preferredStyle: .alert)
        alert.addAction(UIAlertAction(title: "취소", style: .cancel) { _ in completionHandler(false) })
        alert.addAction(UIAlertAction(title: "확인", style: .default) { _ in completionHandler(true) })
        present(alert, animated: true)
    }
    func webView(_ webView: WKWebView, didFailProvisionalNavigation navigation: WKNavigation!, withError error: Error) {
        let alert = UIAlertController(title: "인터넷 연결 확인", message: "화면을 불러오지 못했습니다. 위치 공유는 위쪽 버튼에서 중지할 수 있습니다.", preferredStyle: .alert)
        alert.addAction(UIAlertAction(title: "다시 시도", style: .default) { [weak self] _ in self?.web.load(URLRequest(url: URL(string: serviceOrigin)!)) })
        if presentedViewController == nil { present(alert, animated: true) }
    }
}
