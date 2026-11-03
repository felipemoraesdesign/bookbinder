// This Source Code Form is subject to the terms of the Mozilla Public
// License, v. 2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at https://mozilla.org/MPL/2.0/.

// Native macOS shell for Miolo: a window around the same web app the site serves,
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

/// The app’s own settings (Miolo > Settings), kept in UserDefaults. Settings for a book stay in the page.
enum Preferences {
  /// "system", "pt" or "en"
  static var language: String { UserDefaults.standard.string(forKey: "language") ?? "system" }
  static var saveToDownloads: Bool { UserDefaults.standard.bool(forKey: "saveToDownloads") }
  static var openWhenDone: Bool { UserDefaults.standard.bool(forKey: "openWhenDone") }
  /// "system", "light" or "dark"
  static var theme: String { UserDefaults.standard.string(forKey: "theme") ?? "system" }

  /// The app's appearance; the page's light or dark styles follow it through WebKit.
  static var appearance: NSAppearance? {
    switch theme {
    case "light": return NSAppearance(named: .aqua)
    case "dark": return NSAppearance(named: .darkAqua)
    default: return nil  // the system's
    }
  }

  static var usesPortuguese: Bool {
    language == "system" ? Locale.preferredLanguages.first?.hasPrefix("pt") ?? false : language == "pt"
  }
}

func localized(_ portuguese: String, _ english: String) -> String {
  Preferences.usesPortuguese ? portuguese : english
}

/// The site's top bar (logo, tagline, privacy note, language) has no place in a native window: the Dock
/// and menu carry the name, and the language comes from Settings. The window controls float over the
/// page instead, so the top strip makes room for them and moves the window like a title bar would.
/// The credit under the drop zone moves to Settings > Credits.
func nativeChromeScript() -> String {
  """
  localStorage.setItem('bookbinder_lang', '\(Preferences.usesPortuguese ? "pt" : "en")');
  const style = document.createElement('style');
  // :root raises specificity: this runs before the page's own stylesheet, which would otherwise win.
  style.textContent = `
    :root .topbar, :root .credit { display: none; }
    :root .stage { padding-top: 44px; }
    /* without the credit below it, the empty drop zone needs its own bottom margin, as wide as the sides */
    :root body:not([data-state='loaded']) .stage { padding-bottom: clamp(20px, 4vw, 56px); }
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
}

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
  /// `Miolo --self-test file.pdf`: runs upload → generate → download, saving to a temp folder.
  let selfTestPDF = CommandLine.arguments.firstIndex(of: "--self-test").map {
    URL(fileURLWithPath: CommandLine.arguments[$0 + 1])
  }

  func applicationDidFinishLaunching(_ notification: Notification) {
    NSApp.appearance = Preferences.appearance
    let config = WKWebViewConfiguration()
    let web = Bundle.main.resourceURL!.appendingPathComponent("web")
    config.setURLSchemeHandler(BundleSchemeHandler(root: web), forURLScheme: "app")
    // file-saver takes a WebKit view without "Safari" in its user agent for an old embedded browser and
    // downloads through a data URL that drops the file name; presenting as Safari keeps <a download>.
    config.applicationNameForUserAgent = "Version/18.0 Safari/605.1.15"
    config.userContentController.addUserScript(
      WKUserScript(source: nativeChromeScript(), injectionTime: .atDocumentStart, forMainFrameOnly: true))
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
    window.title = "Miolo"
    window.titleVisibility = .hidden
    window.titlebarAppearsTransparent = true
    window.backgroundColor = paperColor
    window.minSize = NSSize(width: 420, height: 560)
    window.contentView = webView
    window.center()
    window.setFrameAutosaveName("main")
    window.makeKeyAndOrderFront(nil)
    NSApp.activate(ignoringOtherApps: true)

    // The host keeps the app’s old name: it is the origin the saved settings and presets belong to.
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
    if Preferences.saveToDownloads {
      let downloads = FileManager.default.urls(for: .downloadsDirectory, in: .userDomainMask)[0]
      return completionHandler(unusedURL(in: downloads, for: suggestedFilename))
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
    guard selfTestPDF == nil else {
      let name = download.progress.fileURL?.lastPathComponent ?? "?"
      let size = (try? download.progress.fileURL?.resourceValues(forKeys: [.fileSizeKey]).fileSize) ?? 0
      return finishSelfTest(size > 0 ? "PASS downloaded \(name) (\(size) bytes)" : "FAIL empty download")
    }
    guard let url = download.progress.fileURL else { return }
    // Bounces the Downloads stack in the Dock, as browsers do.
    DistributedNotificationCenter.default().post(
      name: Notification.Name("com.apple.DownloadFileFinished"), object: url.path)
    guard Preferences.openWhenDone else { return }
    // A PDF opens ready to print; a .zip is shown in the Finder rather than unpacked.
    if url.pathExtension.lowercased() == "pdf" {
      NSWorkspace.shared.open(url)
    } else {
      NSWorkspace.shared.activateFileViewerSelecting([url])
    }
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
    snapshotSettings()
    let script = """
      for (let i = 0; i < 100 && !document.getElementById('setup_summary').textContent; i++) {
        await new Promise((r) => setTimeout(r, 100));
      }
      // space under the empty drop zone, before the PDF goes in
      const dropGap = Math.round(innerHeight - document.getElementById('dropzone').getBoundingClientRect().bottom);
      const bytes =Uint8Array.from(atob(b64), (c) => c.charCodeAt(0));
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
      return `state=${document.body.dataset.state} sheets=${document.getElementById('total_sheets').textContent} storage=${localStorage.getItem('bookbinder_selftest')} topbar=${getComputedStyle(bar).display} credit=${getComputedStyle(document.querySelector('.credit')).display} stageTop=${getComputedStyle(document.querySelector('.stage')).paddingTop} dropGap=${dropGap} lang=${document.documentElement.lang} dark=${matchMedia('(prefers-color-scheme: dark)').matches} error=${document.getElementById('file_error').textContent} js=${window.__errors.join(' | ')}`;
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
    // a moment for the Settings snapshots still being taken
    DispatchQueue.main.asyncAfter(deadline: .now() + 1.5) { exit(message.hasPrefix("PASS") ? 0 : 1) }
  }

  /// Saves a picture of each Settings tab, to check their layout without looking at the screen.
  func snapshotSettings() {
    showSettings(nil)
    guard let tabs = settingsWindow?.contentViewController as? NSTabViewController else {
      return print("settings: FAIL no tabs")
    }
    for index in tabs.tabViewItems.indices {
      // each tab once the window has drawn it, or its labels come out blank
      DispatchQueue.main.asyncAfter(deadline: .now() + 0.2 + Double(index) * 0.6) {
        tabs.selectedTabViewItemIndex = index
        DispatchQueue.main.asyncAfter(deadline: .now() + 0.4) {
          guard let window = self.settingsWindow, let view = window.contentView?.superview,
            let rep = view.bitmapImageRepForCachingDisplay(in: view.bounds)
          else { return }
          view.cacheDisplay(in: view.bounds, to: rep)
          let png = FileManager.default.temporaryDirectory.appendingPathComponent("miolo-settings-\(index).png")
          try? rep.representation(using: .png, properties: [:])?.write(to: png)
          print("settings: \(window.title) \(png.path)")
        }
      }
    }
  }

  @objc func showAbout(_ sender: Any?) {
    let credits = NSAttributedString(
      string: localized(
        "Fork do bookbinder-js, de momijizukamori e colaboradores, a partir do Bookbinder original.",
        "A fork of bookbinder-js, by momijizukamori and contributors, from the original Bookbinder."),
      attributes: [.font: NSFont.systemFont(ofSize: 11), .foregroundColor: NSColor.secondaryLabelColor])
    NSApp.orderFrontStandardAboutPanel(options: [.credits: credits])
  }

  // MARK: Settings

  var settingsWindow: NSWindow?
  static let languages = ["system", "pt", "en"]
  static let themes = ["system", "light", "dark"]

  @objc func showSettings(_ sender: Any?) {
    if settingsWindow == nil {
      let window = NSWindow(
        contentRect: .zero, styleMask: [.titled, .closable], backing: .buffered, defer: false)
      window.isReleasedWhenClosed = false
      window.toolbarStyle = .preference
      settingsWindow = window
      buildSettings()
      window.center()
    }
    settingsWindow?.makeKeyAndOrderFront(nil)
  }

  /// Settings in two toolbar tabs, as Mac apps lay them out: General and Credits.
  /// Rebuilt after a language change so the window's own text follows.
  func buildSettings() {
    guard let window = settingsWindow else { return }
    let selected = (window.contentViewController as? NSTabViewController)?.selectedTabViewItemIndex ?? 0
    let pages = [
      (localized("Geral", "General"), "gearshape", generalSettingsView()),
      (localized("Créditos", "Credits"), "person.2", creditsView()),
    ]
    let tabs = SettingsTabs()
    tabs.tabStyle = .toolbar
    for (label, symbol, view) in pages {
      let page = NSViewController()
      page.view = view
      page.title = label
      // each tab as tall as its content; the window resizes when switching
      page.preferredContentSize = view.fittingSize
      let item = NSTabViewItem(viewController: page)
      item.label = label
      item.image = NSImage(systemSymbolName: symbol, accessibilityDescription: nil)
      tabs.addTabViewItem(item)
    }
    tabs.selectedTabViewItemIndex = selected
    window.contentViewController = tabs
    window.setContentSize(pages[selected].2.fittingSize)
    window.title = pages[selected].0
  }

  /// Language, theme and what happens to a download, aligned to the left.
  func generalSettingsView() -> NSView {
    let language = popUp(
      [localized("Sistema", "System"), "Português", "English"],
      selected: Self.languages.firstIndex(of: Preferences.language), action: #selector(languageChanged(_:)))
    let theme = popUp(
      [localized("Sistema", "System"), localized("Claro", "Light"), localized("Escuro", "Dark")],
      selected: Self.themes.firstIndex(of: Preferences.theme), action: #selector(themeChanged(_:)))

    // Radio buttons sharing an action and a superview act as one group.
    let ask = NSButton(
      radioButtonWithTitle: localized("Perguntar onde salvar", "Ask where to save"),
      target: self, action: #selector(saveLocationChanged(_:)))
    let downloads = NSButton(
      radioButtonWithTitle: localized("Salvar direto em Downloads", "Save straight to Downloads"),
      target: self, action: #selector(saveLocationChanged(_:)))
    downloads.tag = 1
    (Preferences.saveToDownloads ? downloads : ask).state = .on

    let open = NSButton(
      checkboxWithTitle: localized("Abrir o arquivo ao terminar", "Open the file when it’s done"),
      target: self, action: #selector(openWhenDoneChanged(_:)))
    open.state = Preferences.openWhenDone ? .on : .off
    let hint = NSTextField(
      wrappingLabelWithString: localized(
        "PDFs abrem no Pré-Visualização; arquivos .zip, no Finder.",
        "PDFs open in Preview; .zip files in the Finder."))
    hint.font = .systemFont(ofSize: 11)
    hint.textColor = .secondaryLabelColor
    // a fixed width, so the label knows how many lines it wraps to
    hint.preferredMaxLayoutWidth = 210
    hint.translatesAutoresizingMaskIntoConstraints = false
    // indented to line up with the checkbox's title rather than its box
    let hintBox = NSView()
    hintBox.addSubview(hint)
    NSLayoutConstraint.activate([
      hint.widthAnchor.constraint(equalToConstant: 210),
      hint.leadingAnchor.constraint(equalTo: hintBox.leadingAnchor, constant: 20),
      hint.trailingAnchor.constraint(equalTo: hintBox.trailingAnchor),
      hint.topAnchor.constraint(equalTo: hintBox.topAnchor),
      hint.bottomAnchor.constraint(equalTo: hintBox.bottomAnchor),
    ])

    let grid = NSGridView(views: [
      [NSTextField(labelWithString: localized("Idioma:", "Language:")), language],
      [NSTextField(labelWithString: localized("Tema:", "Theme:")), theme],
      [NSTextField(labelWithString: localized("Ao baixar:", "Downloads:")), ask],
      [NSGridCell.emptyContentView, downloads],
      [NSGridCell.emptyContentView, open],
      [NSGridCell.emptyContentView, hintBox],
    ])
    grid.column(at: 0).xPlacement = .leading
    grid.column(at: 1).xPlacement = .leading
    grid.rowAlignment = .firstBaseline
    grid.columnSpacing = 8
    grid.rowSpacing = 8
    grid.row(at: 2).topPadding = 14
    grid.row(at: 4).topPadding = 6
    // the hint's box has no baseline; it sits right under the checkbox
    grid.row(at: 5).rowAlignment = .none
    grid.row(at: 5).yPlacement = .top
    grid.row(at: 5).topPadding = -2
    // hugs its content, so the form sits at the top left instead of stretching to fill the tab
    grid.setContentHuggingPriority(.defaultHigh, for: .vertical)
    grid.setContentHuggingPriority(.defaultHigh, for: .horizontal)
    // the two menus share a width, so they line up (once both are in the grid)
    theme.widthAnchor.constraint(equalTo: language.widthAnchor).isActive = true

    return page([grid], alignment: .leading)
  }

  /// Who made the app possible, centered like an About window.
  func creditsView() -> NSView {
    let icon = NSImageView(image: NSApp.applicationIconImage)
    icon.imageScaling = .scaleProportionallyUpOrDown
    NSLayoutConstraint.activate([
      icon.widthAnchor.constraint(equalToConstant: 72), icon.heightAnchor.constraint(equalToConstant: 72),
    ])

    let name = NSTextField(labelWithString: "Miolo")
    name.font = .boldSystemFont(ofSize: 15)
    let version = Bundle.main.infoDictionary?["CFBundleShortVersionString"] as? String ?? ""
    let versionLabel = NSTextField(labelWithString: localized("Versão \(version)", "Version \(version)"))
    versionLabel.font = .systemFont(ofSize: 11)
    versionLabel.textColor = .secondaryLabelColor

    let repo = "https://github.com/momijizukamori/bookbinder-js"
    let original = "http://quantumelephant.co.uk/bookbinder/bookbinder.html"
    let credits = Preferences.usesPortuguese
      ? linkedLabel(
        [
          ("Este app é um fork do ", nil), ("bookbinder-js", repo), (", criado por momijizukamori e ", nil),
          ("colaboradores", repo + "/graphs/contributors"), (" a partir do ", nil), ("Bookbinder", original),
          (" original. Toda a lógica de imposição vem do trabalho deles.", nil),
        ], size: 12)
      : linkedLabel(
        [
          ("This app is a fork of ", nil), ("bookbinder-js", repo), (", created by momijizukamori and ", nil),
          ("contributors", repo + "/graphs/contributors"), (" from the original ", nil), ("Bookbinder", original),
          (". All of the imposition logic comes from their work.", nil),
        ], size: 12)
    let code = linkedLabel(
      [(localized("Ver o código no GitHub", "See the code on GitHub"), "https://github.com/felipemoraesdesign/miolo")],
      size: 12)
    let license = linkedLabel(
      [
        (localized("Código aberto sob a ", "Open source under the "), nil),
        ("Mozilla Public License 2.0", "https://www.mozilla.org/MPL/2.0/"),
      ], size: 11, color: .tertiaryLabelColor)

    let content = page([icon, name, versionLabel, credits, code, license], alignment: .centerX)
    content.spacing = 4
    content.setCustomSpacing(10, after: icon)
    content.setCustomSpacing(14, after: versionLabel)
    content.setCustomSpacing(14, after: credits)
    return content
  }

  /// A tab's content: a vertical stack with the window's margins.
  func page(_ views: [NSView], alignment: NSLayoutConstraint.Attribute) -> NSStackView {
    let stack = NSStackView(views: views)
    stack.orientation = .vertical
    stack.alignment = alignment
    stack.spacing = 8
    stack.edgeInsets = NSEdgeInsets(top: 24, left: 40, bottom: 28, right: 40)
    stack.widthAnchor.constraint(equalToConstant: 480).isActive = true
    return stack
  }

  /// A centered, wrapping label whose linked parts open in the default browser.
  func linkedLabel(
    _ parts: [(String, String?)], size: CGFloat, color: NSColor = .secondaryLabelColor
  ) -> NSTextField {
    let paragraph = NSMutableParagraphStyle()
    paragraph.alignment = .center
    paragraph.lineSpacing = 2
    let text = NSMutableAttributedString()
    for (part, link) in parts {
      var attributes: [NSAttributedString.Key: Any] = [
        .font: NSFont.systemFont(ofSize: size), .foregroundColor: color, .paragraphStyle: paragraph,
      ]
      if let link { attributes[.link] = URL(string: link) }
      text.append(NSAttributedString(string: part, attributes: attributes))
    }
    let label = NSTextField(wrappingLabelWithString: "")
    // Links only respond in a selectable field that keeps its text attributes.
    label.isSelectable = true
    label.allowsEditingTextAttributes = true
    label.attributedStringValue = text
    label.alignment = .center
    label.preferredMaxLayoutWidth = 360
    return label
  }

  @objc func languageChanged(_ sender: NSPopUpButton) {
    UserDefaults.standard.set(Self.languages[sender.indexOfSelectedItem], forKey: "language")
    // The page switches now and keeps the language on later loads; menus and this window are rebuilt.
    let scripts = webView.configuration.userContentController
    scripts.removeAllUserScripts()
    scripts.addUserScript(
      WKUserScript(source: nativeChromeScript(), injectionTime: .atDocumentStart, forMainFrameOnly: true))
    webView.evaluateJavaScript("setLanguage('\(Preferences.usesPortuguese ? "pt" : "en")')")
    NSApp.mainMenu = makeMainMenu()
    // After this action returns, so the pop-up isn't replaced while it's still handling the click.
    DispatchQueue.main.async { self.buildSettings() }
  }

  /// A pop-up menu as wide as its longest choice, not the whole column.
  func popUp(_ titles: [String], selected: Int?, action: Selector) -> NSPopUpButton {
    let button = NSPopUpButton()
    button.addItems(withTitles: titles)
    button.selectItem(at: selected ?? 0)
    button.target = self
    button.action = action
    button.setContentHuggingPriority(.defaultHigh, for: .horizontal)
    return button
  }

  @objc func themeChanged(_ sender: NSPopUpButton) {
    UserDefaults.standard.set(Self.themes[sender.indexOfSelectedItem], forKey: "theme")
    NSApp.appearance = Preferences.appearance
  }

  @objc func saveLocationChanged(_ sender: NSButton) {
    UserDefaults.standard.set(sender.tag == 1, forKey: "saveToDownloads")
  }

  @objc func openWhenDoneChanged(_ sender: NSButton) {
    UserDefaults.standard.set(sender.state == .on, forKey: "openWhenDone")
  }
}

/// Settings tabs that, as Mac settings windows do, name the window after the open tab and resize it
/// to fit, keeping its top edge in place.
final class SettingsTabs: NSTabViewController {
  override func tabView(_ tabView: NSTabView, didSelect item: NSTabViewItem?) {
    super.tabView(tabView, didSelect: item)
    guard let window = view.window, let item, let size = item.viewController?.preferredContentSize else {
      return
    }
    window.title = item.label
    var frame = window.frameRect(forContentRect: NSRect(origin: .zero, size: size))
    frame.origin = NSPoint(x: window.frame.minX, y: window.frame.maxY - frame.height)
    window.setFrame(frame, display: true, animate: true)
  }
}

/// `folder/name`, numbered like the Finder ("name 2.pdf") when a file already has that name.
func unusedURL(in folder: URL, for filename: String) -> URL {
  let base = (filename as NSString).deletingPathExtension
  let ext = (filename as NSString).pathExtension
  var url = folder.appendingPathComponent(filename)
  var number = 2
  while FileManager.default.fileExists(atPath: url.path) {
    url = folder.appendingPathComponent(ext.isEmpty ? "\(base) \(number)" : "\(base) \(number).\(ext)")
    number += 1
  }
  return url
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
  main.addItem(menu("Miolo", [
    (localized("Sobre o Miolo", "About Miolo"), #selector(AppDelegate.showAbout(_:)), ""),
    ("", nil, ""),
    (localized("Ajustes…", "Settings…"), #selector(AppDelegate.showSettings(_:)), ","),
    ("", nil, ""),
    (localized("Ocultar Miolo", "Hide Miolo"), #selector(NSApplication.hide(_:)), "h"),
    (localized("Sair do Miolo", "Quit Miolo"), #selector(NSApplication.terminate(_:)), "q"),
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
