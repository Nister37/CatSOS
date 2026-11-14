import { render, screen, act, fireEvent } from '@testing-library/react';
import { ConfirmationModal } from './ConfirmationModal';

describe('ConfirmationModal', () => {
  beforeEach(() => {
    jest.useFakeTimers();
  });

  afterEach(() => {
    jest.runOnlyPendingTimers();
    jest.useRealTimers();
  });

  it('renders modal when isOpen is true', () => {
    act(() => {
      render(
        <ConfirmationModal
          isOpen={true}
          onClose={jest.fn()}
          title="Delete Account"
          description="Are you sure you want to delete your account?"
        />,
      );
    });

    expect(screen.getByRole('dialog')).toBeInTheDocument();
    expect(screen.getByText('Delete Account')).toBeInTheDocument();
    expect(
      screen.getByText('Are you sure you want to delete your account?'),
    ).toBeInTheDocument();
  });

  it('does not render when isOpen is false', () => {
    render(
      <ConfirmationModal
        isOpen={false}
        onClose={jest.fn()}
        title="Delete Account"
      />,
    );

    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });

  it('renders hold-to-confirm mode with circular button and square "Change my mind" button', () => {
    render(
      <ConfirmationModal
        isOpen={true}
        onClose={jest.fn()}
        title="Delete Account"
        mode="hold-to-confirm"
        cancelText="Change my mind"
      />,
    );

    expect(
      screen.getByRole('button', { name: /hold to delete/i }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole('button', { name: /change my mind/i }),
    ).toBeInTheDocument();
  });

  it('calls onClose when "Change my mind" is clicked', async () => {
    const handleClose = jest.fn();
    render(
      <ConfirmationModal
        isOpen={true}
        onClose={handleClose}
        title="Delete Account"
        mode="hold-to-confirm"
      />,
    );

    const cancelBtn = screen.getByRole('button', { name: /change my mind/i });
    // In fake timers, userEvent.click triggers close
    cancelBtn.click();

    act(() => {
      jest.advanceTimersByTime(350);
    });

    expect(handleClose).toHaveBeenCalledTimes(1);
  });

  it('triggers onConfirm when button is held for the specified duration', () => {
    const handleConfirm = jest.fn();
    let now = 1000;
    const realDateNow = Date.now;
    Date.now = jest.fn(() => now);

    try {
      render(
        <ConfirmationModal
          isOpen={true}
          onClose={jest.fn()}
          onConfirm={handleConfirm}
          title="Delete Account"
          mode="hold-to-confirm"
          holdDurationMs={5000}
        />,
      );

      const holdButton = screen.getByRole('button', { name: /hold to delete/i });

      // Start holding
      act(() => {
        fireEvent.mouseDown(holdButton);
      });

      // Advance time by 2.5s (50%)
      now += 2500;
      act(() => {
        jest.advanceTimersByTime(2500);
      });
      expect(handleConfirm).not.toHaveBeenCalled();

      // Advance time past 5s (100%)
      now += 2600;
      act(() => {
        jest.advanceTimersByTime(2600);
      });
      expect(handleConfirm).toHaveBeenCalledTimes(1);
    } finally {
      Date.now = realDateNow;
    }
  });

  it('cancels hold if mouse leaves before completion', () => {
    const handleConfirm = jest.fn();
    let now = 1000;
    const realDateNow = Date.now;
    Date.now = jest.fn(() => now);

    try {
      render(
        <ConfirmationModal
          isOpen={true}
          onClose={jest.fn()}
          onConfirm={handleConfirm}
          title="Delete Account"
          mode="hold-to-confirm"
          holdDurationMs={5000}
        />,
      );

      const holdButton = screen.getByRole('button', { name: /hold to delete/i });

      act(() => {
        fireEvent.mouseDown(holdButton);
      });

      // Advance 2s then release
      now += 2000;
      act(() => {
        jest.advanceTimersByTime(2000);
      });

      act(() => {
        fireEvent.mouseLeave(holdButton);
      });

      // Advance past remaining time
      now += 4000;
      act(() => {
        jest.advanceTimersByTime(4000);
      });

      expect(handleConfirm).not.toHaveBeenCalled();
    } finally {
      Date.now = realDateNow;
    }
  });
});
