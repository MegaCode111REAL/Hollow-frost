/* ============================================================
   HOLLOW FROST — LEVEL PROGRESSION BRIDGE
   ============================================================ */
(function () {
    'use strict';
    var params = new URLSearchParams(window.location.search);
    var level = Number.parseInt(params.get('level') || '1', 10);
    if (!Number.isFinite(level) || level < 1) level = 1;
    var STORAGE_KEY = 'hollow_frost_unlocked_level';
    var completionReported = false;
    var nextLevelCheckInProgress = false;

    function readUnlocked() {
        try {
            var value = Number.parseInt(localStorage.getItem(STORAGE_KEY) || '1', 10);
            return Number.isFinite(value) && value >= 1 ? value : 1;
        } catch (error) { return 1; }
    }
    function writeUnlocked(value) {
        try { localStorage.setItem(STORAGE_KEY, String(Math.max(1, value))); }
        catch (error) { console.warn('Could not save Hollow Frost progression.', error); }
    }
    function nextLevelExists() {
        return fetch('./levels/level_' + (level + 1) + '.json', { cache: 'no-store' })
            .then(function (response) {
                if (!response.ok) throw new Error('HTTP ' + response.status);
                return response.json();
            })
            .then(function (data) {
                if (!data || typeof data !== 'object') throw new Error('Invalid level JSON');
                return true;
            });
    }
    function reportCompletion(nextAvailable) {
        if (completionReported) return;
        completionReported = true;
        var next = level + 1;
        var unlocked = readUnlocked();
        if (nextAvailable) {
            unlocked = Math.max(unlocked, next);
            writeUnlocked(unlocked);
        }
        if (window.parent && window.parent !== window) {
            window.parent.postMessage({
                type: 'hollow-frost-level-complete',
                level: level,
                nextLevel: nextAvailable ? next : null,
                unlockedLevel: unlocked,
                nextLevelAvailable: nextAvailable
            }, window.location.origin);
        }
    }
    function checkCompletion() {
        var title = document.getElementById('titleText');
        var startButton = document.getElementById('startBtn');
        if (!title || !startButton || completionReported || nextLevelCheckInProgress) return;
        if (title.textContent.trim() !== 'Next level coming soon' || startButton.textContent.trim() !== 'Play again') return;
        nextLevelCheckInProgress = true;
        nextLevelExists().then(function () {
            title.textContent = 'Level complete!';
            startButton.textContent = 'Continue';
            reportCompletion(true);
        }).catch(function () {
            nextLevelCheckInProgress = false;
        });
    }
    window.addEventListener('message', function (event) {
        if (event.origin !== window.location.origin || event.source !== window.parent) return;
        if (!event.data || typeof event.data !== 'object' || event.data.type !== 'hollow-frost-start-level') return;
        if (Number.parseInt(event.data.level, 10) !== level) return;
        var startButton = document.getElementById('startBtn');
        var overlay = document.getElementById('overlay');
        if (!startButton || (overlay && overlay.classList.contains('hidden'))) return;
        startButton.click();
    });
    var observer = new MutationObserver(checkCompletion);
    observer.observe(document.documentElement, { subtree: true, childList: true, characterData: true });
    window.addEventListener('load', checkCompletion);
    setInterval(checkCompletion, 250);
})();
