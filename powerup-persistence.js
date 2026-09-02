/* ============================================================
   HOLLOW FROST — PERSISTENT POWERUPS
   Keeps abilities collected in one level when the next level starts.

   game.js keeps `abilities` inside initGame(), so this small loader
   injects the persistence hooks into the existing game source without
   duplicating or rewriting the game itself.
   ============================================================ */
(function () {
    'use strict';

    var STORAGE_KEY = 'hollow_frost_powerups_v1';
    var GAME_SOURCE = './game.js';

    function readAbilities() {
        var defaults = {
            doubleJump: false,
            dash: false,
            wallCling: false,
            breakBlocks: false
        };
        try {
            var raw = localStorage.getItem(STORAGE_KEY);
            if (!raw) return defaults;
            var saved = JSON.parse(raw);
            if (!saved || typeof saved !== 'object') return defaults;
            Object.keys(defaults).forEach(function (key) {
                defaults[key] = saved[key] === true;
            });
        } catch (error) {
            console.warn('Could not read Hollow Frost powerups.', error);
        }
        return defaults;
    }

    function saveAbilities(abilities) {
        try {
            localStorage.setItem(STORAGE_KEY, JSON.stringify({
                doubleJump: abilities.doubleJump === true,
                dash: abilities.dash === true,
                wallCling: abilities.wallCling === true,
                breakBlocks: abilities.breakBlocks === true
            }));
        } catch (error) {
            console.warn('Could not save Hollow Frost powerups.', error);
        }
    }

    fetch(GAME_SOURCE, { cache: 'no-store' })
        .then(function (response) {
            if (!response.ok) throw new Error('Failed to load game.js (' + response.status + ')');
            return response.text();
        })
        .then(function (source) {
            var abilitiesPattern = /var abilities = \{\s*doubleJump:\s*false,\s*dash:\s*false,\s*wallCling:\s*false,\s*breakBlocks:\s*false\s*\};/;
            if (!abilitiesPattern.test(source)) {
                throw new Error('Could not find the game ability state.');
            }

            source = source.replace(abilitiesPattern, function (match) {
                return match + '\n    var __hollowFrostSavedAbilities = ' + JSON.stringify(readAbilities()) + ';\n    abilities.doubleJump = __hollowFrostSavedAbilities.doubleJump;\n    abilities.dash = __hollowFrostSavedAbilities.dash;\n    abilities.wallCling = __hollowFrostSavedAbilities.wallCling;\n    abilities.breakBlocks = __hollowFrostSavedAbilities.breakBlocks;';
            });

            var resetPattern = /function resetRun\(\) \{\s*initFromWorldData\(false\);\s*\}/;
            if (!resetPattern.test(source)) {
                throw new Error('Could not find resetRun().');
            }
            source = source.replace(resetPattern, function (match) {
                return match.replace('initFromWorldData(false);', 'initFromWorldData(false);\n        abilities.doubleJump = __hollowFrostSavedAbilities.doubleJump;\n        abilities.dash = __hollowFrostSavedAbilities.dash;\n        abilities.wallCling = __hollowFrostSavedAbilities.wallCling;\n        abilities.breakBlocks = __hollowFrostSavedAbilities.breakBlocks;\n        updateAbilityIcons();');
            });

            var goalPattern = /else if \(it\.id === 'goal_treasure'\) \{/;
            if (!goalPattern.test(source)) {
                throw new Error('Could not find the treasure completion handler.');
            }
            source = source.replace(goalPattern, function (match) {
                return match + '\n                    try { localStorage.setItem(' + JSON.stringify(STORAGE_KEY) + ', JSON.stringify(abilities)); } catch (error) { console.warn(\'Could not save Hollow Frost powerups.\', error); }';
            });

            /*
             * eval is deliberately used here only for the local game source
             * we just fetched. This keeps the original game.js intact while
             * allowing its private `abilities` object to be initialized from
             * and written to localStorage.
             */
            var script = document.createElement('script');
            script.textContent = source + '\n//# sourceURL=game.js';
            document.head.appendChild(script);
        })
        .catch(function (error) {
            console.error(error);
            var title = document.getElementById('titleText');
            var sub = document.getElementById('subText');
            if (title) title.textContent = 'Could not load game';
            if (sub) {
                sub.textContent = error.message || String(error);
                sub.classList.remove('hidden');
            }
        });
})();
