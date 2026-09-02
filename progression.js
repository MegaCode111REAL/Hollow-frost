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
    var nextLevelCheckInProgress = false;

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

    function nextLevelExists() {
        var nextLevel = level + 1;
        return fetch('./levels/level_' + nextLevel + '.json', {
            method: 'GET',
            cache: 'no-store'
        }).then(function (response) {
            if (!response.ok) throw new Error('Next level returned HTTP ' + response.status);
            return response.json();
        }).then(function (data) {
            if (!data || typeof data !== 'object') throw new Error('Next level is not valid JSON');
            return true;
        });
    }

    function reportCompletion(nextLevelAvailable) {
        if (completionReported) return;
        completionReported = true;

        var nextLevel = level + 1;
        var unlocked = nextLevelAvailable ? Math.max(readUnlocked(), nextLevel) : readUnlocked();

        if (nextLevelAvailable) {
            writeUnlocked(unlocked);
        }

        if (window.parent && window.parent !== window) {
            window.parent.postMessage({
                type: 'hollow-frost-level-complete',
                level: level,
                nextLevel: nextLevelAvailable ? nextLevel : null,
                unlockedLevel: unlocked,
                nextLevelAvailable: nextLevelAvailable
            }, window.location.origin);
        }
    }

    function checkCompletion() {
        var title = document.getElementById('titleText');
        var startButton = document.getElementById('startBtn');
        if (!title || !startButton) return;

        /*
         * game.js currently reaches this screen after the treasure is taken.
         * Only treat it as a progression point once we know the next JSON
         * level actually exists. If it does not exist, leave the original
         * "Next level coming soon" message alone.
         */
        if (
            title.textContent.trim() === 'Next level coming soon' &&
            startButton.textContent.trim() === 'Play again' &&
            !nextLevelCheckInProgress
        ) {
            nextLevelCheckInProgress = true;

            nextLevelExists().then(function () {
                title.textContent = 'Level complete!';
                startButton.textContent = 'Continue';
                reportCompletion(true);
            }).catch(function () {
                /* No next level: keep "Next level coming soon" exactly as-is. */
                nextLevelCheckInProgress = false;
            });
        }
    }

    /*
     * Start a level exactly once for each parent request.
     * Never repeatedly click Start while the game is already running.
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
    setInterval(checkCompletion, 250);
})();
