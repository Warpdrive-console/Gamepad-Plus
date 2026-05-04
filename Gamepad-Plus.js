// Gamepad+ extension written by Warpdrive Team as a universal controller API for Warpdrive Consoles.
// Gamepad+ 2.1
(function(Scratch) {
  'use strict';

  const MAX_CONTROLLERS = 4;

  const state = {
    deadzone: 0.1,
    controllerMapping: new Map(),
    buttonStates: new Map(),
    autoMappings: new Map(),
    actions: new Map(),
    actionStates: new Map(),
    customActions: [],
    focusedGamepadId: 1,
    lastPressedButton: ''
  };

  for (let i = 1; i <= MAX_CONTROLLERS; i++) {
    state.controllerMapping.set(i, i - 1);
  }

  let _lastConnTick = -Infinity;
  let _connFired = false;
  let _disconnFired = false;
  const _knownConnected = new Set();

  function updateConnectionEdges() {
    const now = performance.now();
    if (now - _lastConnTick < 10) return;
    _lastConnTick = now;
    const gamepads = Array.from(navigator.getGamepads()).filter(Boolean);
    const nowConnected = new Set(gamepads.filter(p => p.connected).map(p => p.index));
    _connFired = [...nowConnected].some(i => !_knownConnected.has(i));
    _disconnFired = [..._knownConnected].some(i => !nowConnected.has(i));
    _knownConnected.clear();
    nowConnected.forEach(i => _knownConnected.add(i));
  }

  const BUTTON_MAP_BASE = Object.freeze({
    A: 0, B: 1, X: 2, Y: 3,
    L1: 4, R1: 5, L2: 6, R2: 7,
    Select: 8, Start: 9,
    L3: 10, R3: 11,
    DPadUp: 12, DPadDown: 13, DPadLeft: 14, DPadRight: 15,
    Guide: 16
  });

  function getGamepad(virtualId, util) {
    const id = parseInt(virtualId) || getFocusedId(util);
    const physicalIndex = state.controllerMapping.get(id) ?? (id - 1);
    return navigator.getGamepads()[physicalIndex] || null;
  }

  function getFocusedId(util) {
    if (util?.target?.focusedGamepadId !== undefined) return util.target.focusedGamepadId;
    return state.focusedGamepadId;
  }

  function getSpriteKey(util) {
    return util?.target?.id ?? '__global__';
  }

  function getTargetActions(util) {
    const key = getSpriteKey(util);
    if (!state.actions.has(key)) state.actions.set(key, new Map());
    return state.actions.get(key);
  }

  function roundHundredths(val) {
    return Math.round(val * 100) / 100;
  }

  function applyCircularDeadzone(x, y) {
    const magnitude = Math.sqrt(x * x + y * y);
    if (magnitude < state.deadzone) return { x: 0, y: 0 };
    const scale = Math.min(1, (magnitude - state.deadzone) / (1 - state.deadzone)) / magnitude;
    return { x: x * scale, y: y * scale };
  }

  function getStickVector(pad, stick) {
    const layout = getLayout(pad);
    const axes = stick === 'Left' ? layout.leftStick : layout.rightStick;
    return applyCircularDeadzone(pad.axes[axes.X] || 0, pad.axes[axes.Y] || 0);
  }

  function getLayout(pad) {
    if (!pad) return {
      type: 'none',
      leftStick: { X: 0, Y: 1 },
      rightStick: { X: 2, Y: 3 },
      leftTriggerButton: 6,
      rightTriggerButton: 7,
      faceButtons: { A: 0, B: 1, X: 2, Y: 3 }
    };

    if (state.autoMappings.has(pad.id)) return state.autoMappings.get(pad.id);

    const id = (pad.id || '').toLowerCase();
    const layout = {
      type: 'generic',
      leftStick: { X: 0, Y: 1 },
      rightStick: { X: 2, Y: 3 },
      leftTriggerButton: pad.buttons.length > 6 ? 6 : null,
      rightTriggerButton: pad.buttons.length > 7 ? 7 : null,
      faceButtons: { A: 0, B: 1, X: 2, Y: 3 }
    };

    if (id.includes('switch') || id.includes('pro controller')) {
      layout.faceButtons = { A: 1, B: 0, X: 3, Y: 2 };
      layout.type = 'switch';
    } else if (id.includes('dualshock') || id.includes('dualsense') || id.includes('wireless controller')) {
      layout.type = 'playstation';
    } else if (id.includes('xbox')) {
      layout.type = 'xbox';
    }

    state.autoMappings.set(pad.id, layout);
    return layout;
  }

  function resolveButtonIndex(pad, buttonName) {
    const layout = getLayout(pad);
    return layout.faceButtons[buttonName] ?? BUTTON_MAP_BASE[buttonName];
  }

  function edgeDetect(map, key, pressed) {
    const last = map.get(key) ?? false;
    map.set(key, pressed);
    return { pressed, last };
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
          {
            opcode: 'whenButtonPressed',
            blockType: Scratch.BlockType.HAT,
            text: 'when button [BUTTON] pressed',
            arguments: {
              BUTTON: { type: Scratch.ArgumentType.STRING, defaultValue: 'A', menu: 'buttons' }
            }
          },
          {
            opcode: 'whenButtonReleased',
            blockType: Scratch.BlockType.HAT,
            text: 'when button [BUTTON] released',
            arguments: {
              BUTTON: { type: Scratch.ArgumentType.STRING, defaultValue: 'A', menu: 'buttons' }
            }
          },
          {
            opcode: 'whenAnyButtonPressed',
            blockType: Scratch.BlockType.HAT,
            text: 'when any button pressed'
          },
          {
            opcode: 'whenGamepadConnected',
            blockType: Scratch.BlockType.HAT,
            text: 'when gamepad connected',
            isEdgeActivated: false
          },
          {
            opcode: 'whenGamepadDisconnected',
            blockType: Scratch.BlockType.HAT,
            text: 'when gamepad disconnected',
            isEdgeActivated: false
          },
          {
            opcode: 'buttonPressed',
            blockType: Scratch.BlockType.BOOLEAN,
            text: 'button [BUTTON] is down',
            arguments: {
              BUTTON: { type: Scratch.ArgumentType.STRING, defaultValue: 'A', menu: 'buttons' }
            }
          },
          {
            opcode: 'buttonJustReleased',
            blockType: Scratch.BlockType.BOOLEAN,
            text: 'button [BUTTON] just released',
            arguments: {
              BUTTON: { type: Scratch.ArgumentType.STRING, defaultValue: 'A', menu: 'buttons' }
            }
          },
          {
            opcode: 'anyButtonPressed',
            blockType: Scratch.BlockType.BOOLEAN,
            text: 'any button is pressed'
          },
          {
            opcode: 'getStick',
            blockType: Scratch.BlockType.REPORTER,
            text: '[STICK] stick [AXIS] value',
            arguments: {
              STICK: { type: Scratch.ArgumentType.STRING, defaultValue: 'Left', menu: 'sticks' },
              AXIS: { type: Scratch.ArgumentType.STRING, defaultValue: 'X', menu: 'axes' }
            }
          },
          {
            opcode: 'getRawStick',
            blockType: Scratch.BlockType.REPORTER,
            text: '[STICK] stick [AXIS] raw value',
            arguments: {
              STICK: { type: Scratch.ArgumentType.STRING, defaultValue: 'Left', menu: 'sticks' },
              AXIS: { type: Scratch.ArgumentType.STRING, defaultValue: 'X', menu: 'axes' }
            }
          },
          {
            opcode: 'getStickDirection',
            blockType: Scratch.BlockType.REPORTER,
            text: 'direction of [STICK] stick',
            arguments: {
              STICK: { type: Scratch.ArgumentType.STRING, defaultValue: 'Left', menu: 'sticks' }
            }
          },
          {
            opcode: 'getStickMagnitude',
            blockType: Scratch.BlockType.REPORTER,
            text: 'magnitude of [STICK] stick',
            arguments: {
              STICK: { type: Scratch.ArgumentType.STRING, defaultValue: 'Left', menu: 'sticks' }
            }
          },
          {
            opcode: 'stickInUse',
            blockType: Scratch.BlockType.BOOLEAN,
            text: '[STICK] stick is in use',
            arguments: {
              STICK: { type: Scratch.ArgumentType.STRING, defaultValue: 'Left', menu: 'sticks' }
            }
          },
          {
            opcode: 'stickPointingToward',
            blockType: Scratch.BlockType.BOOLEAN,
            text: '[STICK] stick pointing [DIRECTION]',
            arguments: {
              STICK: { type: Scratch.ArgumentType.STRING, defaultValue: 'Left', menu: 'sticks' },
              DIRECTION: { type: Scratch.ArgumentType.STRING, defaultValue: 'up', menu: 'cardinalMenu' }
            }
          },
          {
            opcode: 'getTrigger',
            blockType: Scratch.BlockType.REPORTER,
            text: 'value of [TRIGGER] trigger',
            arguments: {
              TRIGGER: { type: Scratch.ArgumentType.STRING, defaultValue: 'left', menu: 'triggerMenu' }
            }
          },
          {
            opcode: 'buttonValue',
            blockType: Scratch.BlockType.REPORTER,
            text: 'pressure of button [BUTTON]',
            arguments: {
              BUTTON: { type: Scratch.ArgumentType.STRING, defaultValue: 'A', menu: 'buttons' }
            }
          },
          {
            opcode: 'getAxisRaw',
            blockType: Scratch.BlockType.REPORTER,
            text: 'raw axis [INDEX] value',
            arguments: {
              INDEX: { type: Scratch.ArgumentType.NUMBER, defaultValue: 0 }
            }
          },
          {
            opcode: 'getLastPressedButton',
            blockType: Scratch.BlockType.REPORTER,
            text: 'last pressed button'
          },
          {
            opcode: 'connected',
            blockType: Scratch.BlockType.BOOLEAN,
            text: 'focused pad is connected'
          },
          {
            opcode: 'isSlotConnected',
            blockType: Scratch.BlockType.BOOLEAN,
            text: 'slot [ID] is connected',
            arguments: {
              ID: { type: Scratch.ArgumentType.STRING, defaultValue: '1', menu: 'idMenu' }
            }
          },
          {
            opcode: 'countConnected',
            blockType: Scratch.BlockType.REPORTER,
            text: 'number of connected pads'
          },
          {
            opcode: 'getControllerType',
            blockType: Scratch.BlockType.REPORTER,
            text: 'controller type of focused pad'
          },
          {
            opcode: 'getFocusedGamepadId',
            blockType: Scratch.BlockType.REPORTER,
            text: 'focused gamepad ID'
          },
          {
            opcode: 'getDeadzone',
            blockType: Scratch.BlockType.REPORTER,
            text: 'deadzone'
          },
          {
            opcode: 'remapPad',
            blockType: Scratch.BlockType.COMMAND,
            text: 'swap gamepad slot [SLOT1] with [SLOT2]',
            arguments: {
              SLOT1: { type: Scratch.ArgumentType.STRING, defaultValue: '1', menu: 'idMenu' },
              SLOT2: { type: Scratch.ArgumentType.STRING, defaultValue: '2', menu: 'idMenu' }
            }
          },
          {
            opcode: 'resetMapping',
            blockType: Scratch.BlockType.COMMAND,
            text: 'reset controller mapping'
          },
          {
            opcode: 'setFocusedGamepad',
            blockType: Scratch.BlockType.COMMAND,
            text: 'set focused gamepad to [ID]',
            arguments: {
              ID: { type: Scratch.ArgumentType.STRING, defaultValue: '1', menu: 'idMenu' }
            }
          },
          {
            opcode: 'setDeadzone',
            blockType: Scratch.BlockType.COMMAND,
            text: 'set deadzone to [VALUE]',
            arguments: {
              VALUE: { type: Scratch.ArgumentType.NUMBER, defaultValue: 0.1 }
            }
          },
          {
            opcode: 'listGamepadsBySlot',
            blockType: Scratch.BlockType.REPORTER,
            text: 'list of gamepads by slot'
          },
          {
            opcode: 'listGamepadNames',
            blockType: Scratch.BlockType.REPORTER,
            text: 'gamepad names'
          },
          {
            opcode: 'getNameByIndex',
            blockType: Scratch.BlockType.REPORTER,
            text: 'name at index [INDEX]',
            arguments: {
              INDEX: { type: Scratch.ArgumentType.NUMBER, defaultValue: 1 }
            }
          },
          {
            opcode: 'rumble',
            blockType: Scratch.BlockType.COMMAND,
            text: 'rumble magnitude [STRENGTH] minimum [FLOOR] for [DURATION] seconds',
            arguments: {
              STRENGTH: { type: Scratch.ArgumentType.NUMBER, defaultValue: 1 },
              FLOOR: { type: Scratch.ArgumentType.NUMBER, defaultValue: 0.2 },
              DURATION: { type: Scratch.ArgumentType.NUMBER, defaultValue: 1 }
            }
          },
          {
            opcode: 'createAction',
            blockType: Scratch.BlockType.COMMAND,
            text: 'create action [ACTION]',
            arguments: {
              ACTION: { type: Scratch.ArgumentType.STRING, defaultValue: 'jump' }
            }
          },
          {
            opcode: 'bindAction',
            blockType: Scratch.BlockType.COMMAND,
            text: 'bind action [ACTION] to button [BUTTON]',
            arguments: {
              ACTION: { type: Scratch.ArgumentType.STRING, defaultValue: '', menu: 'actionMenu' },
              BUTTON: { type: Scratch.ArgumentType.STRING, defaultValue: 'A', menu: 'buttons' }
            }
          },
          {
            opcode: 'actionDown',
            blockType: Scratch.BlockType.BOOLEAN,
            text: 'action [ACTION] is down',
            arguments: {
              ACTION: { type: Scratch.ArgumentType.STRING, defaultValue: '', menu: 'actionMenu' }
            }
          },
          {
            opcode: 'whenActionPressed',
            blockType: Scratch.BlockType.HAT,
            text: 'when action [ACTION] pressed',
            arguments: {
              ACTION: { type: Scratch.ArgumentType.STRING, defaultValue: '', menu: 'actionMenu' }
            }
          },
          {
            opcode: 'whenActionReleased',
            blockType: Scratch.BlockType.HAT,
            text: 'when action [ACTION] released',
            arguments: {
              ACTION: { type: Scratch.ArgumentType.STRING, defaultValue: '', menu: 'actionMenu' }
            }
          },
          {
            opcode: 'clearAction',
            blockType: Scratch.BlockType.COMMAND,
            text: 'clear action [ACTION]',
            arguments: {
              ACTION: { type: Scratch.ArgumentType.STRING, defaultValue: '', menu: 'actionMenu' }
            }
          },
          {
            opcode: 'getActionMap',
            blockType: Scratch.BlockType.REPORTER,
            text: 'action map as JSON'
          }
        ],
        menus: {
          buttons: { acceptReporters: true, items: Object.keys(BUTTON_MAP_BASE) },
          sticks: { acceptReporters: true, items: ['Left', 'Right'] },
          axes: { acceptReporters: true, items: ['X', 'Y'] },
          triggerMenu: { acceptReporters: true, items: ['left', 'right'] },
          cardinalMenu: { acceptReporters: true, items: ['up', 'down', 'left', 'right'] },
          actionMenu: { acceptReporters: false, items: 'allActions' },
          idMenu: {
            acceptReporters: true,
            items: Array.from({ length: MAX_CONTROLLERS }, (_, i) => String(i + 1))
          }
        }
      };
    }

    allActions() {
      if (state.customActions.length === 0) return ['(no actions)'];
      return state.customActions;
    }

    whenButtonPressed({ BUTTON }, util) {
      const pad = getGamepad(getFocusedId(util), util);
      if (!pad) return false;
      const { pressed, last } = edgeDetect(
        state.buttonStates,
        `${getSpriteKey(util)}:${getFocusedId(util)}:hp:${BUTTON}`,
        pad.buttons[resolveButtonIndex(pad, BUTTON)]?.pressed || false
      );
      return pressed && !last;
    }

    whenButtonReleased({ BUTTON }, util) {
      const pad = getGamepad(getFocusedId(util), util);
      if (!pad) return false;
      const { pressed, last } = edgeDetect(
        state.buttonStates,
        `${getSpriteKey(util)}:${getFocusedId(util)}:hr:${BUTTON}`,
        pad.buttons[resolveButtonIndex(pad, BUTTON)]?.pressed || false
      );
      return !pressed && last;
    }

    whenAnyButtonPressed(_, util) {
      const pad = getGamepad(getFocusedId(util), util);
      if (!pad) return false;
      const { pressed, last } = edgeDetect(
        state.buttonStates,
        `${getSpriteKey(util)}:${getFocusedId(util)}:hany`,
        pad.buttons.some(b => b?.pressed)
      );
      return pressed && !last;
    }

    whenGamepadConnected() {
      updateConnectionEdges();
      return _connFired;
    }

    whenGamepadDisconnected() {
      updateConnectionEdges();
      return _disconnFired;
    }

    buttonPressed({ BUTTON }, util) {
      const pad = getGamepad(getFocusedId(util), util);
      if (!pad) return false;
      return pad.buttons[resolveButtonIndex(pad, BUTTON)]?.pressed || false;
    }

    buttonJustReleased({ BUTTON }, util) {
      const pad = getGamepad(getFocusedId(util), util);
      if (!pad) return false;
      const { pressed, last } = edgeDetect(
        state.buttonStates,
        `${getSpriteKey(util)}:${getFocusedId(util)}:br:${BUTTON}`,
        pad.buttons[resolveButtonIndex(pad, BUTTON)]?.pressed || false
      );
      return !pressed && last;
    }

    anyButtonPressed(_, util) {
      const pad = getGamepad(getFocusedId(util), util);
      if (!pad) return false;
      return pad.buttons.some(b => b?.pressed);
    }

    buttonValue({ BUTTON }, util) {
      const pad = getGamepad(getFocusedId(util), util);
      if (!pad) return 0;
      return roundHundredths(pad.buttons[resolveButtonIndex(pad, BUTTON)]?.value ?? 0);
    }

    getStick({ STICK, AXIS }, util) {
      const pad = getGamepad(getFocusedId(util), util);
      if (!pad) return 0;
      const { x, y } = getStickVector(pad, STICK);
      return roundHundredths(AXIS === 'X' ? x : y);
    }

    getRawStick({ STICK, AXIS }, util) {
      const pad = getGamepad(getFocusedId(util), util);
      if (!pad) return 0;
      const layout = getLayout(pad);
      const axes = STICK === 'Left' ? layout.leftStick : layout.rightStick;
      return roundHundredths(pad.axes[axes[AXIS]] || 0);
    }

    getStickDirection({ STICK }, util) {
      const pad = getGamepad(getFocusedId(util), util);
      if (!pad) return 0;
      const { x, y } = getStickVector(pad, STICK);
      if (x === 0 && y === 0) return 0;
      let angle = Math.atan2(x, -y) * (180 / Math.PI);
      angle = ((angle + 180) % 360) - 180;
      return Math.round(angle);
    }

    getStickMagnitude({ STICK }, util) {
      const pad = getGamepad(getFocusedId(util), util);
      if (!pad) return 0;
      const { x, y } = getStickVector(pad, STICK);
      return roundHundredths(Math.min(1, Math.sqrt(x * x + y * y)));
    }

    stickInUse({ STICK }, util) {
      return this.getStickMagnitude({ STICK }, util) > 0;
    }

    stickPointingToward({ STICK, DIRECTION }, util) {
      const pad = getGamepad(getFocusedId(util), util);
      if (!pad) return false;
      const { x, y } = getStickVector(pad, STICK);
      if (x === 0 && y === 0) return false;
      switch (DIRECTION) {
        case 'up':    return y < 0 && Math.abs(y) >= Math.abs(x);
        case 'down':  return y > 0 && Math.abs(y) >= Math.abs(x);
        case 'left':  return x < 0 && Math.abs(x) > Math.abs(y);
        case 'right': return x > 0 && Math.abs(x) > Math.abs(y);
        default:      return false;
      }
    }

    getTrigger({ TRIGGER }, util) {
      const pad = getGamepad(getFocusedId(util), util);
      if (!pad || !pad.connected) return 0;
      const layout = getLayout(pad);
      const isLeft = TRIGGER === 'left';
      let val;
      if (isLeft) {
        val = layout.leftTriggerButton !== null
          ? (pad.buttons[layout.leftTriggerButton]?.value ?? 0)
          : ((pad.axes[2] ?? -1) / 2 + 0.5);
      } else {
        val = layout.rightTriggerButton !== null
          ? (pad.buttons[layout.rightTriggerButton]?.value ?? 0)
          : ((pad.axes[5] ?? -1) / 2 + 0.5);
      }
      return roundHundredths(Math.max(0, Math.min(1, val)));
    }

    getAxisRaw({ INDEX }, util) {
      const pad = getGamepad(getFocusedId(util), util);
      if (!pad) return 0;
      return roundHundredths(pad.axes[parseInt(INDEX)] ?? 0);
    }

    getLastPressedButton(_, util) {
      const pad = getGamepad(getFocusedId(util), util);
      if (pad) {
        for (const name of Object.keys(BUTTON_MAP_BASE)) {
          const index = resolveButtonIndex(pad, name);
          const pressed = pad.buttons[index]?.pressed || false;
          const key = `lp:${getFocusedId(util)}:${name}`;
          const last = state.buttonStates.get(key) ?? false;
          state.buttonStates.set(key, pressed);
          if (pressed && !last) state.lastPressedButton = name;
        }
      }
      return state.lastPressedButton;
    }

    connected(_, util) {
      const pad = getGamepad(getFocusedId(util), util);
      return pad !== null && pad.connected;
    }

    isSlotConnected({ ID }) {
      const id = parseInt(ID);
      if (id < 1 || id > MAX_CONTROLLERS) return false;
      const pad = navigator.getGamepads()[state.controllerMapping.get(id) ?? (id - 1)];
      return !!(pad && pad.connected);
    }

    countConnected() {
      return Array.from(navigator.getGamepads()).filter(p => p && p.connected).length;
    }

    getControllerType(_, util) {
      const pad = getGamepad(getFocusedId(util), util);
      if (!pad) return 'none';
      return getLayout(pad).type;
    }

    getFocusedGamepadId(_, util) {
      return getFocusedId(util);
    }

    getDeadzone() {
      return state.deadzone;
    }

    remapPad({ SLOT1, SLOT2 }) {
      const slot1 = parseInt(SLOT1), slot2 = parseInt(SLOT2);
      if (slot1 < 1 || slot1 > MAX_CONTROLLERS || slot2 < 1 || slot2 > MAX_CONTROLLERS || slot1 === slot2) return;
      const phys1 = state.controllerMapping.get(slot1) ?? (slot1 - 1);
      const phys2 = state.controllerMapping.get(slot2) ?? (slot2 - 1);
      state.controllerMapping.set(slot1, phys2);
      state.controllerMapping.set(slot2, phys1);
      state.buttonStates.clear();
      state.actionStates.clear();
      const gamepads = navigator.getGamepads();
      if (gamepads[phys1]) state.autoMappings.delete(gamepads[phys1].id);
      if (gamepads[phys2]) state.autoMappings.delete(gamepads[phys2].id);
    }

    resetMapping() {
      for (let i = 1; i <= MAX_CONTROLLERS; i++) {
        state.controllerMapping.set(i, i - 1);
      }
      state.buttonStates.clear();
      state.actionStates.clear();
      state.autoMappings.clear();
    }

    setFocusedGamepad({ ID }, util) {
      const id = parseInt(ID);
      if (id < 1 || id > MAX_CONTROLLERS) return;
      if (util?.target) util.target.focusedGamepadId = id;
      state.focusedGamepadId = id;
    }

    setDeadzone({ VALUE }) {
      const val = parseFloat(VALUE);
      if (!isNaN(val)) state.deadzone = Math.max(0, Math.min(1, val));
    }

    listGamepadsBySlot() {
      const gamepads = navigator.getGamepads();
      return JSON.stringify(
        Array.from({ length: MAX_CONTROLLERS }, (_, i) => {
          const pad = gamepads[state.controllerMapping.get(i + 1) ?? i];
          return pad && pad.connected ? pad.id : '';
        })
      );
    }

    listGamepadNames() {
      const gamepads = navigator.getGamepads();
      return JSON.stringify(
        Array.from({ length: MAX_CONTROLLERS }, (_, i) => {
          const pad = gamepads[state.controllerMapping.get(i + 1) ?? i];
          if (!pad || !pad.connected) return '';
          return (pad.id || '').split(/[\(\-\[]/)[0].trim();
        })
      );
    }

    getNameByIndex({ INDEX }) {
      const idx = Math.floor(INDEX) - 1;
      if (idx < 0 || idx >= MAX_CONTROLLERS) return '';
      try {
        return JSON.parse(this.listGamepadNames())[idx] || '';
      } catch {
        return '';
      }
    }

    async rumble({ STRENGTH, DURATION, FLOOR }, util) {
      const pad = getGamepad(getFocusedId(util), util);
      if (!pad?.vibrationActuator) return;
      const strength = Math.max(parseFloat(FLOOR) || 0, Math.min(parseFloat(STRENGTH) || 1, 1));
      const duration = Math.max(0, (parseFloat(DURATION) || 0) * 1000);
      if (strength === 0 || duration === 0) return;
      try {
        const actuator = pad.vibrationActuator;
        if (typeof actuator.playEffect === 'function') {
          await actuator.playEffect('dual-rumble', {
            duration,
            strongMagnitude: strength,
            weakMagnitude: strength
          });
        } else if (typeof actuator.pulse === 'function') {
          await actuator.pulse(strength, duration);
        }
      } catch (e) {
        console.warn('Rumble failed:', e);
      }
    }

    createAction({ ACTION }) {
      const actionName = String(ACTION).trim();
      if (actionName && !state.customActions.includes(actionName)) {
        state.customActions.push(actionName);
        if (this.vm?.refreshExtensionBlocks) this.vm.refreshExtensionBlocks();
      }
    }

    bindAction({ ACTION, BUTTON }, util) {
      const actionName = String(ACTION).trim();
      if (!actionName) return;
      if (!state.customActions.includes(actionName)) {
        state.customActions.push(actionName);
        if (this.vm?.refreshExtensionBlocks) this.vm.refreshExtensionBlocks();
      }
      getTargetActions(util).set(actionName, BUTTON);
    }

    actionDown({ ACTION }, util) {
      const actionName = String(ACTION).trim();
      const btn = getTargetActions(util).get(actionName);
      if (!btn) return false;
      return this.buttonPressed({ BUTTON: btn }, util);
    }

    whenActionPressed({ ACTION }, util) {
      const actionName = String(ACTION).trim();
      const btn = getTargetActions(util).get(actionName);
      if (!btn) return false;
      const pad = getGamepad(getFocusedId(util), util);
      if (!pad) return false;
      const { pressed, last } = edgeDetect(
        state.actionStates,
        `${getSpriteKey(util)}:${getFocusedId(util)}:ap:${actionName}`,
        pad.buttons[resolveButtonIndex(pad, btn)]?.pressed || false
      );
      return pressed && !last;
    }

    whenActionReleased({ ACTION }, util) {
      const actionName = String(ACTION).trim();
      const btn = getTargetActions(util).get(actionName);
      if (!btn) return false;
      const pad = getGamepad(getFocusedId(util), util);
      if (!pad) return false;
      const { pressed, last } = edgeDetect(
        state.actionStates,
        `${getSpriteKey(util)}:${getFocusedId(util)}:ar:${actionName}`,
        pad.buttons[resolveButtonIndex(pad, btn)]?.pressed || false
      );
      return !pressed && last;
    }

    clearAction({ ACTION }, util) {
      const actionName = String(ACTION).trim();
      getTargetActions(util).delete(actionName);
      const anyHas = Array.from(state.actions.values()).some(m => m.has(actionName));
      if (!anyHas) {
        const idx = state.customActions.indexOf(actionName);
        if (idx >= 0) state.customActions.splice(idx, 1);
        if (this.vm?.refreshExtensionBlocks) this.vm.refreshExtensionBlocks();
      }
    }

    getActionMap(_, util) {
      const targetActions = getTargetActions(util);
      return JSON.stringify(
        state.customActions.map(action => ({
          action,
          button: targetActions.get(action) || null
        }))
      );
    }
  }

  Scratch.extensions.register(new GamepadExtension());
})(Scratch);
