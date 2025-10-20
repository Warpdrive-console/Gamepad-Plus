// Gamepad+ extension written by Warpdrive Team as a universal controller API for Warpdrive Consoles.
// Gamepad+ 1.7
(function(Scratch) {
    'use strict';

    const MAX_CONTROLLERS = 16;

    const state = {
        deadzone: 0.1,
        controllerMapping: new Map(),
        buttonStates: new Map(),
        autoMappings: new Map(),
        focusedGamepadId: 1
    };

    for (let i = 1; i <= MAX_CONTROLLERS; i++) {
        state.controllerMapping.set(i, i - 1);
    }

    const BUTTON_MAP_BASE = Object.freeze({
        A: 0, B: 1, X: 2, Y: 3,
        L1: 4, R1: 5, L2: 6, R2: 7,
        Select: 8, Start: 9, L3: 10, R3: 11,
        DPadUp: 12, DPadDown: 13, DPadLeft: 14, DPadRight: 15,
        Guide: 16
    });

    const DEFAULT_MAPPING = Object.freeze({
        type: "generic",
        leftStick: { X: 0, Y: 1 },
        rightStick: { X: 2, Y: 3 },
        leftTriggerButton: 6,
        rightTriggerButton: 7,
        faceButtons: { A: 0, B: 1, X: 2, Y: 3 }
    });

    function getGamepad(virtualId) {
        const id = parseInt(virtualId) || state.focusedGamepadId;
        const physicalIndex = state.controllerMapping.get(id) ?? (id - 1);
        const gamepads = navigator.getGamepads();
        return gamepads[physicalIndex] || null;
    }

    function getFocusedId(util) {
        return util?.target?.focusedGamepadId || state.focusedGamepadId;
    }

    function roundHundredths(val) {
        return Math.round(val * 100) / 100;
    }

    function getLayout(pad) {
        if (!pad) return DEFAULT_MAPPING;
        if (state.autoMappings.has(pad.id)) return state.autoMappings.get(pad.id);

        const id = (pad.id || '').toLowerCase();
        let layout = { ...DEFAULT_MAPPING };

        if (id.includes("switch") || id.includes("pro controller") || id.includes("Switch")) {
            layout.faceButtons = { A: 1, B: 0, X: 3, Y: 2 }; // Nintendo swap A/B
            layout.type = "switch";
        } else if (id.includes("dualshock") || id.includes("dualsense") || id.includes("wireless controller")) {
            layout.leftTriggerButton = 6;
            layout.rightTriggerButton = 7;
            layout.type = "playstation";
        } else if (id.includes("xbox")) {
            layout.type = "xbox";
        }

        if (pad.axes.length >= 6) {
            layout.leftTriggerButton = pad.buttons[6] ? 6 : null;
            layout.rightTriggerButton = pad.buttons[7] ? 7 : null;
        }

        state.autoMappings.set(pad.id, layout);
        return layout;
    }

    class GamepadExtension {
        getInfo() {
            return {
                id: 'gamepadplus',
                name: 'Gamepad+',
                color1: '#3b5e48',
                color2: '#2e4a39',
                color3: '#4c7d5c',
                blocks: [
                    { opcode: 'whenButtonPressed', blockType: Scratch.BlockType.HAT, text: 'when button [BUTTON] pressed', arguments: { BUTTON: { type: Scratch.ArgumentType.STRING, defaultValue: 'A', menu: 'buttons' } } },
                    { opcode: 'buttonPressed', blockType: Scratch.BlockType.BOOLEAN, text: 'button [BUTTON] is down', arguments: { BUTTON: { type: Scratch.ArgumentType.STRING, defaultValue: 'A', menu: 'buttons' } } },
                    { opcode: 'getStick', blockType: Scratch.BlockType.REPORTER, text: '[STICK] stick [AXIS] value', arguments: { STICK: { type: Scratch.ArgumentType.STRING, defaultValue: 'Left', menu: 'sticks' }, AXIS: { type: Scratch.ArgumentType.STRING, defaultValue: 'X', menu: 'axes' } } },
                    { opcode: 'getStickDirection', blockType: Scratch.BlockType.REPORTER, text: 'direction of [STICK] stick', arguments: { STICK: { type: Scratch.ArgumentType.STRING, defaultValue: 'Left', menu: 'sticks' } } },
                    { opcode: 'getStickMagnitude', blockType: Scratch.BlockType.REPORTER, text: 'magnitude of [STICK] stick', arguments: { STICK: { type: Scratch.ArgumentType.STRING, defaultValue: 'Left', menu: 'sticks' } } },
                    { opcode: 'stickInUse', blockType: Scratch.BlockType.BOOLEAN, text: '[STICK] stick is in use', arguments: { STICK: { type: Scratch.ArgumentType.STRING, defaultValue: 'Left', menu: 'sticks' } } },
                    { opcode: 'getTrigger', blockType: Scratch.BlockType.REPORTER, text: 'value of [TRIGGER] trigger', arguments: { TRIGGER: { type: Scratch.ArgumentType.STRING, defaultValue: 'left', menu: 'triggerMenu' } } },
                    { opcode: 'buttonValue', blockType: Scratch.BlockType.REPORTER, text: 'pressure of button [BUTTON]', arguments: { BUTTON: { type: Scratch.ArgumentType.STRING, defaultValue: 'A', menu: 'buttons' } } },
                    { opcode: 'connected', blockType: Scratch.BlockType.BOOLEAN, text: 'focused pad is connected' },
                    { opcode: 'countConnected', blockType: Scratch.BlockType.REPORTER, text: 'number of connected pads' },
                    { opcode: 'remapPad', blockType: Scratch.BlockType.COMMAND, text: 'swap gamepad slot [SLOT1] with [SLOT2]', arguments: { SLOT1: { type: Scratch.ArgumentType.STRING, defaultValue: '1', menu: 'idMenu' }, SLOT2: { type: Scratch.ArgumentType.STRING, defaultValue: '2', menu: 'idMenu' } } },
                    { opcode: 'setFocusedGamepad', blockType: Scratch.BlockType.COMMAND, text: 'set focused gamepad to [ID]', arguments: { ID: { type: Scratch.ArgumentType.STRING, defaultValue: '1', menu: 'idMenu' } } },
                    { opcode: 'setDeadzone', blockType: Scratch.BlockType.COMMAND, text: 'set deadzone to [VALUE]', arguments: { VALUE: { type: Scratch.ArgumentType.NUMBER, defaultValue: 0.1 } } },
                    { opcode: 'listGamepadsBySlot', blockType: Scratch.BlockType.REPORTER, text: 'list of gamepads by slot' },
                    { opcode: 'listGamepadNames', blockType: Scratch.BlockType.REPORTER, text: 'gamepad names' },
                    { opcode: 'getNameByIndex', blockType: Scratch.BlockType.REPORTER, text: 'name at index [INDEX]', arguments: { INDEX: { type: Scratch.ArgumentType.NUMBER, defaultValue: 1 } } },
                    { opcode: 'rumble', blockType: Scratch.BlockType.COMMAND, text: 'rumble magnitude [STRENGTH] minimum [FLOOR] for [DURATION] seconds', arguments: { STRENGTH: { type: Scratch.ArgumentType.NUMBER, defaultValue: 1 }, FLOOR: { type: Scratch.ArgumentType.NUMBER, defaultValue: 0.2 }, DURATION: { type: Scratch.ArgumentType.NUMBER, defaultValue: 1 } } }
                ],
                menus: {
                    buttons: { acceptReporters: true, items: Object.keys(BUTTON_MAP_BASE) },
                    sticks: { acceptReporters: true, items: ['Left', 'Right'] },
                    axes: { acceptReporters: true, items: ['X', 'Y'] },
                    triggerMenu: { acceptReporters: true, items: ['left', 'right'] },
                    idMenu: { acceptReporters: true, items: Array.from({ length: MAX_CONTROLLERS }, (_, i) => String(i + 1)) }
                }
            };
        }

        whenButtonPressed({ BUTTON }, util) {
            const gamepad = getGamepad(getFocusedId(util));
            if (!gamepad) return false;
            const layout = getLayout(gamepad);
            const index = layout.faceButtons[BUTTON] ?? BUTTON_MAP_BASE[BUTTON];
            if (index === undefined) return false;

            const btn = gamepad.buttons[index];
            if (!btn) return false;

            const isPressed = btn.pressed || false;
            const stateKey = `${getFocusedId(util)}:${BUTTON}`;
            const wasPressed = state.buttonStates.get(stateKey) || false;
            state.buttonStates.set(stateKey, isPressed);
            return isPressed && !wasPressed;
        }

        buttonPressed({ BUTTON }, util) {
            const gamepad = getGamepad(getFocusedId(util));
            if (!gamepad) return false;
            const layout = getLayout(gamepad);
            const index = layout.faceButtons[BUTTON] ?? BUTTON_MAP_BASE[BUTTON];
            return gamepad.buttons[index]?.pressed || false;
        }

        buttonValue({ BUTTON }, util) {
            const gamepad = getGamepad(getFocusedId(util));
            if (!gamepad) return 0;
            const layout = getLayout(gamepad);
            const index = layout.faceButtons[BUTTON] ?? BUTTON_MAP_BASE[BUTTON];
            const btn = gamepad.buttons[index];
            if (!btn) return 0;
            return roundHundredths(btn.value ?? (btn.pressed ? 1 : 0));
        }

        getStick({ STICK, AXIS }, util) {
            const pad = getGamepad(getFocusedId(util));
            if (!pad) return 0;
            const layout = getLayout(pad);
            const axes = STICK === 'Left' ? layout.leftStick : layout.rightStick;
            return applyDeadzone(pad.axes[axes[AXIS]] || 0);
        }

        getStickDirection({ STICK }, util) {
            const pad = getGamepad(getFocusedId(util));
            if (!pad) return 0;
            const layout = getLayout(pad);
            const axes = STICK === 'Left' ? layout.leftStick : layout.rightStick;
            const x = applyDeadzone(pad.axes[axes.X] || 0);
            const y = applyDeadzone(pad.axes[axes.Y] || 0);
            if (x === 0 && y === 0) return 0;
            let angle = Math.atan2(x, -y) * (180 / Math.PI);
            angle = ((angle + 180) % 360) - 180;
            return Math.round(angle);
        }

        getStickMagnitude({ STICK }, util) {
            const pad = getGamepad(getFocusedId(util));
            if (!pad) return 0;
            const layout = getLayout(pad);
            const axes = STICK === 'Left' ? layout.leftStick : layout.rightStick;
            const x = applyDeadzone(pad.axes[axes.X] || 0);
            const y = applyDeadzone(pad.axes[axes.Y] || 0);
            return Math.min(1, Math.sqrt(x * x + y * y));
        }

        stickInUse({ STICK }, util) {
            return this.getStickMagnitude({ STICK }, util) >= state.deadzone;
        }

        getTrigger({ TRIGGER }, util) {
            const pad = getGamepad(getFocusedId(util));
            if (!pad || !pad.connected) return 0;
            const layout = getLayout(pad);
            const isLeft = TRIGGER === 'left';
            let val = 0;

            if (isLeft) {
                if (layout.leftTriggerButton !== null) val = pad.buttons[layout.leftTriggerButton]?.value ?? 0;
                else val = (pad.axes[2] ?? -1) / 2 + 0.5;
            } else {
                if (layout.rightTriggerButton !== null) val = pad.buttons[layout.rightTriggerButton]?.value ?? 0;
                else val = (pad.axes[5] ?? -1) / 2 + 0.5;
            }

            return roundHundredths(val);
        }

        connected(_, util) {
            const pad = getGamepad(getFocusedId(util));
            return pad !== null && pad.connected;
        }

        countConnected() {
            return Array.from(navigator.getGamepads()).filter(p => p && p.connected).length;
        }

        remapPad({ SLOT1, SLOT2 }) {
            const slot1 = parseInt(SLOT1), slot2 = parseInt(SLOT2);
            if (slot1 < 1 || slot1 > MAX_CONTROLLERS || slot2 < 1 || slot2 > MAX_CONTROLLERS || slot1 === slot2) return;

            const phys1 = state.controllerMapping.get(slot1) ?? (slot1 - 1);
            const phys2 = state.controllerMapping.get(slot2) ?? (slot2 - 1);
            state.controllerMapping.set(slot1, phys2);
            state.controllerMapping.set(slot2, phys1);

            for (const key of state.buttonStates.keys()) {
                const [slotId] = key.split(':');
                if (parseInt(slotId) === slot1 || parseInt(slotId) === slot2) state.buttonStates.delete(key);
            }

            const gamepads = navigator.getGamepads();
            if (gamepads[phys1]) state.autoMappings.delete(gamepads[phys1].id);
            if (gamepads[phys2]) state.autoMappings.delete(gamepads[phys2].id);
        }

        setFocusedGamepad({ ID }, util) {
            const id = parseInt(ID);
            if (id < 1 || id > MAX_CONTROLLERS) return;
            if (util && util.target) util.target.focusedGamepadId = id;
            state.focusedGamepadId = id;
        }

        setDeadzone({ VALUE }) {
            const val = parseFloat(VALUE);
            if (!isNaN(val)) state.deadzone = Math.max(0, Math.min(1, val));
        }

        listGamepadsBySlot() {
            const gamepads = navigator.getGamepads();
            return JSON.stringify(Array.from({ length: MAX_CONTROLLERS }, (_, i) => {
                const pad = gamepads[state.controllerMapping.get(i + 1) ?? i];
                return pad && pad.connected ? pad.id : '';
            }));
        }

        listGamepadNames() {
            const gamepads = navigator.getGamepads();
            return JSON.stringify(Array.from({ length: MAX_CONTROLLERS }, (_, i) => {
                const pad = gamepads[state.controllerMapping.get(i + 1) ?? i];
                if (!pad || !pad.connected) return '';
                return (pad.id || '').split(/[\(\-\[]/)[0].trim();
            }));
        }

        getNameByIndex({ INDEX }) {
            const idx = Math.floor(INDEX) - 1;
            if (idx < 0 || idx >= MAX_CONTROLLERS) return '';
            try { return JSON.parse(this.listGamepadNames())[idx] || ''; } catch { return ''; }
        }

        async rumble({ STRENGTH, DURATION, FLOOR }, util) {
            const pad = getGamepad(getFocusedId(util));
            if (!pad || !pad.vibrationActuator || pad.vibrationActuator.type !== 'dual-rumble') return;
            const strength = Math.max(parseFloat(FLOOR) || 0, Math.min(parseFloat(STRENGTH) || 1, 1));
            const duration = Math.max(0, (parseFloat(DURATION) || 0) * 1000);
            if (strength === 0 || duration === 0) return;

            try {
                await pad.vibrationActuator.playEffect('dual-rumble', { duration, strongMagnitude: strength, weakMagnitude: strength });
            } catch (e) { console.warn('Rumble failed:', e); }
        }
    }

    function applyDeadzone(value) {
        const abs = Math.abs(value);
        if (abs < state.deadzone) return 0;
        return value / (1 - state.deadzone) * (abs > 0 ? 1 : 0);
    }

    Scratch.extensions.register(new GamepadExtension());
})(Scratch);

