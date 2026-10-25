import Foundation

/// ゲームのセーブ（ページの localStorage）をアプリ側にも控えておく。
/// WebKit が端末の空き容量などの都合でページのデータを消しても、次に開いたときに書き戻す。
struct SaveStore {
    private let key = "webLocalStorage"

    func load() -> [String: String] {
        UserDefaults.standard.dictionary(forKey: key) as? [String: String] ?? [:]
    }

    func save(_ items: [String: String]) {
        UserDefaults.standard.set(items, forKey: key)
    }

    /// ページのスクリプトより先に動かすもの：消えていたら書き戻し、以後の書き込みをアプリへ知らせる
    func restoreScript() -> String {
        let data = (try? JSONSerialization.data(withJSONObject: load())) ?? Data("{}".utf8)
        let saved = String(data: data, encoding: .utf8) ?? "{}"
        return """
        (function(){
          var saved = \(saved);
          try{ for(var k in saved) if(localStorage.getItem(k) === null) localStorage.setItem(k, saved[k]); }catch(e){}
          var timer = 0;
          var snap = function(){
            var all = {};
            try{ for(var i = 0; i < localStorage.length; i++){ var k = localStorage.key(i); all[k] = localStorage.getItem(k); } }catch(e){ return; }
            try{ webkit.messageHandlers.native.postMessage({type: 'save', data: all}); }catch(e){}
          };
          var later = function(){ clearTimeout(timer); timer = setTimeout(snap, 400); };
          var P = Storage.prototype, set = P.setItem, rem = P.removeItem, clr = P.clear;
          P.setItem = function(k, v){ set.call(this, k, v); if(this === window.localStorage) later(); };
          P.removeItem = function(k){ rem.call(this, k); if(this === window.localStorage) later(); };
          P.clear = function(){ clr.call(this); if(this === window.localStorage) later(); };
          document.addEventListener('visibilitychange', function(){ if(document.hidden) snap(); });
        })();
        """
    }
}
