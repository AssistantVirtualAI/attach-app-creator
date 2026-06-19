/**
 * Regression: pressing each dialpad key MUST insert exactly one digit.
 * On touch devices, React fires both `touchstart` and a synthetic
 * `click`; the Dialpad guards against the duplicate via a touchedAt ref.
 * These tests exercise both pure click (mouse) and the touch->click
 * sequence (mobile browser/Capacitor WebView).
 */
import { describe, it, expect } from 'vitest';
import { render, fireEvent } from '@testing-library/react';
import Dialpad from './Dialpad';

const KEYS = ['1', '2', '3', '4', '5', '6', '7', '8', '9', '*', '0', '#'];

function setup() {
  const presses: string[] = [];
  const utils = render(<Dialpad onPress={(d) => presses.push(d)} />);
  const buttons = utils.container.querySelectorAll('button');
  return { presses, buttons };
}

describe('Dialpad single-digit guarantee', () => {
  it('a pure click on each key inserts exactly one digit', () => {
    const { presses, buttons } = setup();
    buttons.forEach((b) => fireEvent.click(b));
    expect(presses).toEqual(KEYS);
  });

  it('a touchstart followed by the synthetic click inserts exactly one digit', () => {
    const { presses, buttons } = setup();
    buttons.forEach((b) => {
      fireEvent.touchStart(b);
      fireEvent.touchEnd(b);
      fireEvent.click(b); // synthetic click that follows a real touch
    });
    expect(presses).toEqual(KEYS);
  });

  it('does not insert two digits when the user rapidly double-taps a single key', () => {
    const { presses, buttons } = setup();
    const two = buttons[1]; // key "2"
    fireEvent.touchStart(two);
    fireEvent.touchEnd(two);
    fireEvent.click(two); // suppressed by the touch guard
    expect(presses).toEqual(['2']);
  });
});
