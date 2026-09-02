/* ============================================================
   HOLLOW FROST — LEVEL PROGRESSION BRIDGE
   Runs inside game.html and talks to index.html with postMessage.
   ============================================================ */

(function () {
    'use strict';

    var params = new URLSearchParams(window.location.search);
    var level = Number.parseInt(params.get('level') || '1', 10);
    if (!Number.isFinite(level) || level < 1) level = 1;

    var STORAGE_KEY = 'hollow_frost_unlocked_level';
    var completionReported = false;

    function readUnlocked() {
        try {
            var value = Number.parseInt(localStorage.getItem(STORAGE_KEY) || '1', 10);
            return Number.isFinite(value) && value >= 1 ? value : 1;
        } catch (error) {
            return 1;
        }
    }

    function writeUnlocked(value) {
        try {
            localStorage.setItem(STORAGE_KEY, String(Math.max(1, value)));
        } catch (error) {
            console.warn('Could not save Hollow Frost progression.', error);
        }
    }

    function reportCompletion() {
        if (completionReported) return;
        completionReported = true;

        var nextLevel = level + 1;
        var unlocked = Math.max(readUnlocked(), nextLevel);
        writeUnlocked(unlocked);

        if (window.parent && window.parent !== window) {
            window.parent.postMessage({
                type: 'hollow-frost-level-complete',
                level: level,
                nextLevel: nextLevel,
                unlockedLevel: unlocked
            }, window.location.origin);
        }
    }

    function checkCompletion() {
        var title = document.getElementById('titleText');
        var startButton = document.getElementById('startBtn');
        if (!title || !startButton) return;

        /* game.js shows this exact screen after the treasure is reached. */
        if (
            title.textContent.trim() === 'Next level coming soon' &&
            startButton.textContent.trim() === 'Play again'
        ) {
            reportCompletion();
        }
    }

    /*
     * Start a level exactly once for each parent request.
     * index.html used to retry the same message every 150ms, which caused
     * startBtn.click() -> resetRun() to run repeatedly for about a second.
     */
    window.addEventListener('message', function (event) {
        if (event.origin !== window.location.origin) return;
        if (event.source !== window.parent) return;
        if (!event.data || typeof event.data !== 'object') return;
        if (event.data.type !== 'hollow-frost-start-level') return;

        var requested = Number.parseInt(event.data.level, 10);
        if (requested !== level) return;

        var startButton = document.getElementById('startBtn');
        if (!startButton) return;

        /* Do not start an already-running game. */
        var overlay = document.getElementById('overlay');
        if (overlay && overlay.classList.contains('hidden')) return;

        startButton.click();
    });

    var observer = new MutationObserver(checkCompletion);
    observer.observe(document.documentElement, {
        subtree: true,
        childList: true,
        characterData: true
    });

    window.addEventListener('load', checkCompletion);
    setInterval(checkCompletion, 100);
})();
