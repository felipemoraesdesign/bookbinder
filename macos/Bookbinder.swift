// This Source Code Form is subject to the terms of the Mozilla Public
// License, v. 2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at https://mozilla.org/MPL/2.0/.

// Native macOS shell for Bookbinder: a window around the same web app the site serves,
// rendered by the system's WebKit. The imposition engine stays in JavaScript.

import AppKit
import UniformTypeIdentifiers
import WebKit

/// Serves the bundled web build at app://bookbinder/, giving ES modules and localStorage a real origin.
final class BundleSchemeHandler: NSObject, WKURLSchemeHandler {
  let root: URL

  init(root: URL) { self.root = root.standardizedFileURL }

  func webView(_ webView: WKWebView, start task: WKURLSchemeTask) {
    let url = task.request.url!
    let file = root.appendingPathComponent(url.path == "/" ? "index.html" : url.path).standardizedFileURL
    guard file.path.hasPrefix(root.path + "/"), let data = try? Data(contentsOf: file) else {
      task.didFailWithError(URLError(.fileDoesNotExist))
      return
    }
    let mime = UTType(filenameExtension: file.pathExtension)?.preferredMIMEType ?? "application/octet-stream"
    task.didReceive(URLResponse(url: url, mimeType: mime, expectedContentLength: data.count, textEncodingName: "utf-8"))
    task.didReceive(data)
    task.didFinish()
  }

  func webView(_ webView: WKWebView, stop task: WKURLSchemeTask) {}
}

/// Keeps the last mouse-down so the top of the page can start a native window drag with it.
final class AppWebView: WKWebView {
  var lastMouseDown: NSEvent?

  override func mouseDown(with event: NSEvent) {
    lastMouseDown = event
    super.mouseDown(with: event)
  }
}

/// Native apps follow the system language; the page's own switcher is hidden in the app.
let usesPortuguese = Locale.preferredLanguages.first?.hasPrefix("pt") ?? false

func localized(_ portuguese: String, _ english: String) -> String { usesPortuguese ? portuguese : english }

/// The site's top bar (logo, tagline, privacy note, language) has no place in a native window: the Dock
/// and menu carry the name, and the language follows the system. The window controls float over the
/// page instead, so the top strip makes room for them and moves the window like a title bar would.
let nativeChromeScript = """
  localStorage.setItem('bookbinder_lang', '\(usesPortuguese ? "pt" : "en")');
  const style = document.createElement('style');
  // :root raises specificity: this runs before the page's own stylesheet, which would otherwise win.
  style.textContent = `
    :root .topbar { display: none; }
    :root .stage { padding-top: 44px; }
    @media (min-width: 961px) { :root .inspector { top: 0; height: 100dvh; } }
  `;
  document.documentElement.append(style);
  document.addEventListener('mousedown', (event) => {
    const interactive = event.target.closest('a, button, input, select, summary, label, iframe');
    if (event.button === 0 && event.clientY < 40 && !interactive) {
      window.webkit.messageHandlers.titleBar.postMessage(event.detail === 2 ? 'double-click' : 'drag');
    }
  });
  """

/// The page's --bg token, in light and dark.
let paperColor = NSColor(name: nil) { appearance in
  appearance.bestMatch(from: [.aqua, .darkAqua]) == .darkAqua
    ? NSColor(srgbRed: 26 / 255, green: 21 / 255, blue: 18 / 255, alpha: 1)
    : NSColor(srgbRed: 247 / 255, green: 244 / 255, blue: 238 / 255, alpha: 1)
}

@MainActor
final class AppDelegate: NSObject, NSApplicationDelegate, WKNavigationDelegate, WKUIDelegate, WKDownloadDelegate,
  WKScriptMessageHandler
{
  var window: NSWindow!
  var webView: AppWebView!
  /// `Bookbinder --self-test file.pdf`: runs upload → generate → download, saving to a temp folder.
  let selfTestPDF = CommandLine.arguments.firstIndex(of: "--self-test").map {
    URL(fileURLWithPath: CommandLine.arguments[$0 + 1])
  }

  func applicationDidFinishLaunching(_ notification: Notification) {
    let config = WKWebViewConfiguration()
    let web = Bundle.main.resourceURL!.appendingPathComponent("web")
    config.setURLSchemeHandler(BundleSchemeHandler(root: web), forURLScheme: "app")
    // file-saver takes a WebKit view without "Safari" in its user agent for an old embedded browser and
    // downloads through a data URL that drops the file name; presenting as Safari keeps <a download>.
    config.applicationNameForUserAgent = "Version/18.0 Safari/605.1.15"
    config.userContentController.addUserScript(
      WKUserScript(source: nativeChromeScript, injectionTime: .atDocumentStart, forMainFrameOnly: true))
    config.userContentController.add(self, name: "titleBar")
    if selfTestPDF != nil {
      // Fresh, throwaway storage: the test must not read or overwrite the user's saved settings.
      config.websiteDataStore = .nonPersistent()
      config.userContentController.addUserScript(WKUserScript(
        source: "window.__errors = []; addEventListener('error', (e) => __errors.push(e.message)); addEventListener('unhandledrejection', (e) => __errors.push(String(e.reason)));",
        injectionTime: .atDocumentStart, forMainFrameOnly: true))
    }

    webView = AppWebView(frame: .zero, configuration: config)
    webView.navigationDelegate = self
    webView.uiDelegate = self
    // Let the window's paper color show until the page paints, instead of a white flash.
    webView.setValue(false, forKey: "drawsBackground")

    window = NSWindow(
      contentRect: NSRect(x: 0, y: 0, width: 1280, height: 820),
      styleMask: [.titled, .closable, .miniaturizable, .resizable, .fullSizeContentView],
      backing: .buffered, defer: false)
    window.title = "Bookbinder"
    window.titleVisibility = .hidden
    window.titlebarAppearsTransparent = true
    window.backgroundColor = paperColor
    window.minSize = NSSize(width: 420, height: 560)
    window.contentView = webView
    window.center()
    window.setFrameAutosaveName("main")
    window.makeKeyAndOrderFront(nil)
    NSApp.activate(ignoringOtherApps: true)

    webView.load(URLRequest(url: URL(string: "app://bookbinder/")!))
    if selfTestPDF != nil {
      DispatchQueue.main.asyncAfter(deadline: .now() + 60) { self.finishSelfTest("FAIL timed out") }
    }
  }

  func applicationShouldTerminateAfterLastWindowClosed(_ sender: NSApplication) -> Bool { true }

  // MARK: Window controls over the page

  func userContentController(_ controller: WKUserContentController, didReceive message: WKScriptMessage) {
    guard message.body as? String == "double-click" else {
      if let event = webView.lastMouseDown { window.performDrag(with: event) }
      return
    }
    // Same as a double-click on a regular title bar, following System Settings > Desktop & Dock.
    switch UserDefaults.standard.string(forKey: "AppleActionOnDoubleClick") {
    case "Minimize": window.performMiniaturize(nil)
    case "None": break
    default: window.performZoom(nil)
    }
  }

  // MARK: Files in and out

  /// The page's <input type="file">.
  func webView(
    _ webView: WKWebView, runOpenPanelWith parameters: WKOpenPanelParameters,
    initiatedByFrame frame: WKFrameInfo, completionHandler: @escaping ([URL]?) -> Void
  ) {
    let panel = NSOpenPanel()
    panel.allowedContentTypes = [.pdf]
    panel.beginSheetModal(for: window) { completionHandler($0 == .OK ? panel.urls : nil) }
  }

  func webView(
    _ webView: WKWebView, decidePolicyFor action: WKNavigationAction,
    decisionHandler: @escaping (WKNavigationActionPolicy) -> Void
  ) {
    if action.shouldPerformDownload { return decisionHandler(.download) }
    // Links that leave the app (credits, GitHub) open in the default browser.
    if let url = action.request.url, url.scheme == "http" || url.scheme == "https" {
      NSWorkspace.shared.open(url)
      return decisionHandler(.cancel)
    }
    decisionHandler(.allow)
  }

  /// target="_blank" links.
  func webView(
    _ webView: WKWebView, createWebViewWith configuration: WKWebViewConfiguration,
    for action: WKNavigationAction, windowFeatures: WKWindowFeatures
  ) -> WKWebView? {
    if let url = action.request.url { NSWorkspace.shared.open(url) }
    return nil
  }

  func webView(_ webView: WKWebView, navigationAction: WKNavigationAction, didBecome download: WKDownload) {
    download.delegate = self
  }

  func download(
    _ download: WKDownload, decideDestinationUsing response: URLResponse, suggestedFilename: String,
    completionHandler: @escaping (URL?) -> Void
  ) {
    if selfTestPDF != nil {
      let url = FileManager.default.temporaryDirectory.appendingPathComponent(suggestedFilename)
      try? FileManager.default.removeItem(at: url)
      return completionHandler(url)
    }
    let panel = NSSavePanel()
    panel.nameFieldStringValue = suggestedFilename
    panel.beginSheetModal(for: window) { response in
      guard response == .OK, let url = panel.url else { return completionHandler(nil) }
      // WKDownload refuses an existing file; the panel already asked whether to replace it.
      try? FileManager.default.removeItem(at: url)
      completionHandler(url)
    }
  }

  func downloadDidFinish(_ download: WKDownload) {
    guard selfTestPDF != nil else { return }
    let name = download.progress.fileURL?.lastPathComponent ?? "?"
    let size = (try? download.progress.fileURL?.resourceValues(forKeys: [.fileSizeKey]).fileSize) ?? 0
    finishSelfTest(size > 0 ? "PASS downloaded \(name) (\(size) bytes)" : "FAIL empty download")
  }

  func download(_ download: WKDownload, didFailWithError error: Error, resumeData: Data?) {
    finishSelfTest("FAIL download error: \(error.localizedDescription)")
  }

  // MARK: Self-test

  func webView(_ webView: WKWebView, didFinish navigation: WKNavigation!) {
    guard let pdf = selfTestPDF, let data = try? Data(contentsOf: pdf) else {
      if selfTestPDF != nil { finishSelfTest("FAIL cannot read \(selfTestPDF!.path)") }
      return
    }
    let script = """
      for (let i = 0; i < 100 && !document.getElementById('setup_summary').textContent; i++) {
        await new Promise((r) => setTimeout(r, 100));
      }
      const bytes = Uint8Array.from(atob(b64), (c) => c.charCodeAt(0));
      const dt = new DataTransfer();
      dt.items.add(new File([bytes], name, { type: 'application/pdf' }));
      const input = document.getElementById('input_file');
      input.files = dt.files;
      input.dispatchEvent(new Event('change', { bubbles: true }));
      for (let i = 0; i < 100 && document.body.dataset.state !== 'loaded'; i++) {
        await new Promise((r) => setTimeout(r, 100));
      }
      await new Promise((r) => setTimeout(r, 500));
      localStorage.setItem('bookbinder_selftest', '1');
      document.getElementById('generate').click();
      const bar = document.querySelector('.topbar');
      return `state=${document.body.dataset.state} sheets=${document.getElementById('total_sheets').textContent} storage=${localStorage.getItem('bookbinder_selftest')} topbar=${getComputedStyle(bar).display} stageTop=${getComputedStyle(document.querySelector('.stage')).paddingTop} lang=${document.documentElement.lang} error=${document.getElementById('file_error').textContent} js=${window.__errors.join(' | ')}`;
      """
    webView.callAsyncJavaScript(
      script, arguments: ["b64": data.base64EncodedString(), "name": pdf.lastPathComponent],
      in: nil, in: .page
    ) { result in
      switch result {
      case .success(let value): print("page: \(value)")
      case .failure(let error): self.finishSelfTest("FAIL script: \(error)")
      }
    }
  }

  func finishSelfTest(_ message: String) {
    print(message)
    exit(message.hasPrefix("PASS") ? 0 : 1)
  }

  @objc func showAbout(_ sender: Any?) {
    let credits = NSAttributedString(
      string: localized(
        "Fork do bookbinder-js, de momijizukamori e colaboradores, a partir do Bookbinder original.",
        "A fork of bookbinder-js, by momijizukamori and contributors, from the original Bookbinder."),
      attributes: [.font: NSFont.systemFont(ofSize: 11), .foregroundColor: NSColor.secondaryLabelColor])
    NSApp.orderFrontStandardAboutPanel(options: [.credits: credits])
  }
}

func makeMainMenu() -> NSMenu {
  func menu(_ title: String, _ items: [(String, Selector?, String)]) -> NSMenuItem {
    let submenu = NSMenu(title: title)
    for (name, action, key) in items {
      submenu.addItem(name.isEmpty ? .separator() : NSMenuItem(title: name, action: action, keyEquivalent: key))
    }
    let item = NSMenuItem()
    item.submenu = submenu
    return item
  }
  let main = NSMenu()
  main.addItem(menu("Bookbinder", [
    (localized("Sobre o Bookbinder", "About Bookbinder"), #selector(AppDelegate.showAbout(_:)), ""),
    ("", nil, ""),
    (localized("Ocultar Bookbinder", "Hide Bookbinder"), #selector(NSApplication.hide(_:)), "h"),
    (localized("Sair do Bookbinder", "Quit Bookbinder"), #selector(NSApplication.terminate(_:)), "q"),
  ]))
  // Without an Edit menu, Cmd+C / Cmd+V do nothing in the page's text fields.
  main.addItem(menu(localized("Editar", "Edit"), [
    (localized("Desfazer", "Undo"), Selector(("undo:")), "z"),
    (localized("Refazer", "Redo"), Selector(("redo:")), "Z"),
    ("", nil, ""),
    (localized("Recortar", "Cut"), #selector(NSText.cut(_:)), "x"),
    (localized("Copiar", "Copy"), #selector(NSText.copy(_:)), "c"),
    (localized("Colar", "Paste"), #selector(NSText.paste(_:)), "v"),
    (localized("Selecionar Tudo", "Select All"), #selector(NSText.selectAll(_:)), "a"),
  ]))
  main.addItem(menu(localized("Janela", "Window"), [
    (localized("Minimizar", "Minimize"), #selector(NSWindow.performMiniaturize(_:)), "m"),
    (localized("Fechar", "Close"), #selector(NSWindow.performClose(_:)), "w"),
  ]))
  return main
}

MainActor.assumeIsolated {
  let app = NSApplication.shared
  let delegate = AppDelegate()
  app.delegate = delegate
  app.setActivationPolicy(.regular)
  app.mainMenu = makeMainMenu()
  app.run()
}
