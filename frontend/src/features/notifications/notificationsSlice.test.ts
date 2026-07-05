import reducer, { addNotification, dismissNotification } from './notificationsSlice';

describe('notificationsSlice', () => {
  it('adds and dismisses notifications', () => {
    const withNotification = reducer(undefined, addNotification('Report queued for review.', 'success'));

    expect(withNotification.items).toHaveLength(1);
    expect(withNotification.items[0]).toEqual(
      expect.objectContaining({
        message: 'Report queued for review.',
        tone: 'success',
      }),
    );

    const dismissed = reducer(withNotification, dismissNotification(withNotification.items[0].id));

    expect(dismissed.items).toEqual([]);
  });
});
