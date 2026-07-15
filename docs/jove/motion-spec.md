# Jove Motion Specification

## Motion sentence

Jove notices, pauses, performs one small intentional action, and settles into stillness.

## Timing

- Most purposeful actions: 1–3 seconds
- Eye movement may precede head or body movement
- Use slight anticipation before physical effort
- Use a very small overshoot only when it communicates weight
- End in a stable static pose
- Do not loop purposeful actions continuously

## Idle behavior

Idle motion is optional in V1. If used, it should be infrequent and barely perceptible, such as a small breath or weight shift. It must not resemble loading, pulsing, or attention-seeking.

## Physical qualities

- Calm
- Intentional
- Slightly imperfect
- Believable weight and resistance
- No rubbery limbs
- No springy cartoon easing
- No constant floating

## Reduced motion

- Honor `prefers-reduced-motion`.
- Show the final static pose instead of running the transition.
- Never hide essential information behind animation.
- Motion must not be the sole indicator of application state.

## Performance and lifecycle

- Animation must not alter layout dimensions.
- Stop or avoid animation when offscreen or when the document is not visible, using existing application patterns where practical.
- No more than one actively animated Jove should appear on a screen at a time in V1.
- Avoid JavaScript animation loops when CSS or an existing motion library can express the behavior safely.

## Prohibited motion

- Dancing
- Waving loops
- Bouncing
- Pulsing
- Spinning
- Confetti or celebration bursts
- Repeated falling
- Frantic loading behavior
- Following the pointer
- Reacting to every keystroke
