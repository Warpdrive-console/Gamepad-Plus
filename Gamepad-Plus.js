// Gamepad+ extension written by Warpdrive Team as a universal controller API for Warpdrive Consoles.
// Gamepad+ 2.0
(function(Scratch) {
    'use strict';

    const MAX_CONTROLLERS = 16;

    const state = {
        deadzone: 0.1,
        controllerMapping: new Map(),
        buttonStates: new Map(),
        autoMappings: new Map(),
        actions: new Map(),
        actionStates: new Map(),
        customActions: []
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

    function getGamepad(util, virtualId) {
        const id = parseInt(virtualId) || getFocusedId(util);
        const physicalIndex = state.controllerMapping.get(id) ?? (id - 1);
        return navigator.getGamepads()[physicalIndex] || null;
    }

    function getFocusedId(util) {
        if (!util?.target?.focusedGamepadId) util.target.focusedGamepadId = 1;
        return util.target.focusedGamepadId;
    }

    function roundHundredths(val) {
        return Math.round(val * 100) / 100;
    }

    function applyDeadzone(value) {
        const abs = Math.abs(value);
        if (abs < state.deadzone) return 0;
        return value / (1 - state.deadzone);
    }

    function getLayout(pad) {
        if (!pad) return DEFAULT_MAPPING;
        if (state.autoMappings.has(pad.id)) return state.autoMappings.get(pad.id);

        const id = (pad.id || '').toLowerCase();
        let layout = { ...DEFAULT_MAPPING };

        if (id.includes("switch") || id.includes("pro controller")) {
            layout.faceButtons = { A: 1, B: 0, X: 3, Y: 2 };
            layout.type = "switch";
        } else if (id.includes("dualshock") || id.includes("dualsense") || id.includes("wireless controller")) {
            layout.type = "playstation";
        } else if (id.includes("xbox")) {
            layout.type = "xbox";
        }

        state.autoMappings.set(pad.id, layout);
        return layout;
    }

    function resolveButtonIndex(pad, buttonName) {
        const layout = getLayout(pad);
        return layout.faceButtons[buttonName] ?? BUTTON_MAP_BASE[buttonName];
    }

    class GamepadExtension {
        constructor() {
            this.vm = null;
        }

        setRuntime(runtime) {
            this.vm = runtime;
        }

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
                    { opcode: 'setDeadzone', blockType: Scratch.BlockType.COMMAND, text: 'set deadzone to [VALUE]', arguments: { VALUE: { type: Scratch.ArgumentType.NUMBER, defaultValue: 0.1 } } },
                    { opcode: 'createAction', blockType: Scratch.BlockType.COMMAND, text: 'create action [ACTION]', arguments: { ACTION: { type: Scratch.ArgumentType.STRING, defaultValue: 'jump' } } },
                    { opcode: 'bindAction', blockType: Scratch.BlockType.COMMAND, text: 'bind action [ACTION] to button [BUTTON]', arguments: { ACTION: { type: Scratch.ArgumentType.STRING, defaultValue: '', menu: 'actionMenu' }, BUTTON: { type: Scratch.ArgumentType.STRING, defaultValue: 'A', menu: 'buttons' } } },
                    { opcode: 'actionDown', blockType: Scratch.BlockType.BOOLEAN, text: 'action [ACTION] is down', arguments: { ACTION: { type: Scratch.ArgumentType.STRING, defaultValue: '', menu: 'actionMenu' } } },
                    { opcode: 'whenActionPressed', blockType: Scratch.BlockType.HAT, text: 'when action [ACTION] pressed', arguments: { ACTION: { type: Scratch.ArgumentType.STRING, defaultValue: '', menu: 'actionMenu' } } },
                    { opcode: 'clearAction', blockType: Scratch.BlockType.COMMAND, text: 'clear action [ACTION]', arguments: { ACTION: { type: Scratch.ArgumentType.STRING, defaultValue: '', menu: 'actionMenu' } } },
                    { opcode: 'getActionMap', blockType: Scratch.BlockType.REPORTER, text: 'action map as JSON', arguments: {} }
                ],
                menus: {
                    buttons: { acceptReporters: true, items: Object.keys(BUTTON_MAP_BASE) },
                    sticks: { acceptReporters: true, items: ['Left', 'Right'] },
                    axes: { acceptReporters: true, items: ['X', 'Y'] },
                    triggerMenu: { acceptReporters: true, items: ['left', 'right'] },
                    actionMenu: { acceptReporters: false, items: 'allActions' }
                }
            };
        }

        allActions() {
            if (state.customActions.length === 0) return ["(no actions)"];
            return state.customActions;
        }

        whenButtonPressed({ BUTTON }, util) {
            const pad = getGamepad(util);
            if (!pad) return false;
            const index = resolveButtonIndex(pad, BUTTON);
            const pressed = pad.buttons[index]?.pressed || false;
            const key = `${getFocusedId(util)}:${BUTTON}`;
            const last = state.buttonStates.get(key) || false;
            state.buttonStates.set(key, pressed);
            return pressed && !last;
        }

        buttonPressed({ BUTTON }, util) {
            const pad = getGamepad(util);
            if (!pad) return false;
            return pad.buttons[resolveButtonIndex(pad, BUTTON)]?.pressed || false;
        }

        buttonValue({ BUTTON }, util) {
            const pad = getGamepad(util);
            if (!pad) return 0;
            const btn = pad.buttons[resolveButtonIndex(pad, BUTTON)];
            return roundHundredths(btn?.value ?? 0);
        }

        getStick({ STICK, AXIS }, util) {
            const pad = getGamepad(util);
            if (!pad) return 0;
            const axes = getLayout(pad)[STICK === 'Left' ? 'leftStick' : 'rightStick'];
            return applyDeadzone(pad.axes[axes[AXIS]] || 0);
        }

        getStickDirection({ STICK }, util) {
            const pad = getGamepad(util);
            if (!pad) return 0;
            const axes = getLayout(pad)[STICK === 'Left' ? 'leftStick' : 'rightStick'];
            const x = applyDeadzone(pad.axes[axes.X] || 0);
            const y = applyDeadzone(pad.axes[axes.Y] || 0);
            if (!x && !y) return 0;
            return Math.round(Math.atan2(x, -y) * 180 / Math.PI);
        }

        getStickMagnitude({ STICK }, util) {
            const pad = getGamepad(util);
            if (!pad) return 0;
            const axes = getLayout(pad)[STICK === 'Left' ? 'leftStick' : 'rightStick'];
            const x = applyDeadzone(pad.axes[axes.X] || 0);
            const y = applyDeadzone(pad.axes[axes.Y] || 0);
            return Math.min(1, Math.sqrt(x*x + y*y));
        }

        stickInUse(args, util) {
            return this.getStickMagnitude(args, util) > 0;
        }

        getTrigger({ TRIGGER }, util) {
            const pad = getGamepad(util);
            if (!pad) return 0;
            return roundHundredths(pad.buttons[TRIGGER === 'left' ? 6 : 7]?.value || 0);
        }

        connected(_, util) {
            return !!getGamepad(util)?.connected;
        }

        countConnected() {
            return navigator.getGamepads().filter(p => p?.connected).length;
        }

        setDeadzone({ VALUE }) {
            state.deadzone = Math.max(0, Math.min(1, Number(VALUE)));
        }

        createAction({ ACTION }) {
            const actionName = String(ACTION).trim();
            if (actionName && !state.customActions.includes(actionName)) {
                state.customActions.push(actionName);
                if (this.vm?.refreshExtensionBlocks) this.vm.refreshExtensionBlocks();
            }
        }

        bindAction({ ACTION, BUTTON }) {
            const actionName = String(ACTION).trim();
            if (actionName && !state.customActions.includes(actionName)) {
                state.customActions.push(actionName);
                if (this.vm?.refreshExtensionBlocks) this.vm.refreshExtensionBlocks();
            }
            if (actionName) {
                state.actions.set(actionName, BUTTON);
            }
        }

        clearAction({ ACTION }) {
            const actionName = String(ACTION).trim();
            state.actions.delete(actionName);
            const idx = state.customActions.indexOf(actionName);
            if (idx >= 0) state.customActions.splice(idx, 1);
            if (this.vm?.refreshExtensionBlocks) this.vm.refreshExtensionBlocks();
        }

        actionDown({ ACTION }, util) {
            const actionName = String(ACTION).trim();
            const btn = state.actions.get(actionName);
            if (!btn) return false;
            return this.buttonPressed({ BUTTON: btn }, util);
        }

        whenActionPressed({ ACTION }, util) {
            const actionName = String(ACTION).trim();
            const btn = state.actions.get(actionName);
            if (!btn) return false;
            const pad = getGamepad(util);
            if (!pad) return false;
            const index = resolveButtonIndex(pad, btn);
            const pressed = pad.buttons[index]?.pressed || false;
            const key = `${getFocusedId(util)}:${actionName}`;
            const last = state.actionStates.get(key) || false;
            state.actionStates.set(key, pressed);
            return pressed && !last;
        }

        getActionMap() {
            const actionArray = [];
            for (const action of state.customActions) {
                const button = state.actions.get(action);
                actionArray.push({
                    action: action,
                    button: button || null
                });
            }
            return JSON.stringify(actionArray);
        }
    }

    Scratch.extensions.register(new GamepadExtension());

    if (Scratch.vm) {
        const ext = new GamepadExtension();
        ext.setRuntime(Scratch.vm);
    }
})(Scratch);
