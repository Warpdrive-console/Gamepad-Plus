# Gamepad+
Gamepad+ is an extension for Scratch mods that uses the Gamepad API to create a close to universal extension for most modern controllers, and input devices in the usecase of Warpdrive App Development.

Known Issues:
- It doesn't like all Switch Pro Controllers

# Docs
# Focus Gamepad

<img width="491" height="96" alt="focus" src="https://github.com/user-attachments/assets/8155c540-8a0e-4771-8c22-fe4436d2aa71" />

This block allows you to choose which connected gamepad listens for your input code. It also accepts both public *and* private variables as well. This allows for multiple gamepads to use the same input code.
There's several ways to allow multiple gamepads to use the same input code, but I suggest having a "Controls" Sprite create a clone for every connected gamepad, then assign each clone with a private variable matching a corresponding gamepad.

<img width="687" height="577" alt="gamead setupi" src="https://github.com/user-attachments/assets/d3526c72-e6db-4c40-98ae-2d7534473e7e" />

From there, you can add controls as normal:

<img width="1670" height="801" alt="movement code" src="https://github.com/user-attachments/assets/73c492d1-5fac-465e-9def-2f278a9e38e5" />
