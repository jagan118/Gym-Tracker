const mockAggregate = jest.fn();
const mockCountDocuments = jest.fn();
const mockDeleteMany = jest.fn();

jest.mock('../models/Workout', () => ({
  aggregate: (...args) => mockAggregate(...args),
  countDocuments: (...args) => mockCountDocuments(...args),
  deleteMany: (...args) => mockDeleteMany(...args),
}));

const { getConsistency, deleteInvalidGroupWorkouts } = require('../controllers/workoutController');

const makeResponse = () => ({
  statusCode: 200,
  body: null,
  status(code) {
    this.statusCode = code;
    return this;
  },
  json(body) {
    this.body = body;
    return this;
  },
});

describe('Workout overview and legacy cleanup', () => {
  beforeEach(() => jest.clearAllMocks());

  it('returns unique workout dates and the count of invalid-group records', async () => {
    mockAggregate.mockResolvedValue([{ date: '2026-10-12' }, { date: '2026-10-15' }]);
    mockCountDocuments.mockResolvedValue(2);
    const res = makeResponse();
    const next = jest.fn();

    await getConsistency({ user: { id: '507f1f77bcf86cd799439011' } }, res, next);

    expect(res.body).toMatchObject({
      success: true,
      workoutDates: ['2026-10-12', '2026-10-15'],
      invalidGroupCount: 2,
    });
    expect(mockAggregate).toHaveBeenCalledWith(
      expect.arrayContaining([expect.objectContaining({ $match: { userId: expect.anything() } })])
    );
    expect(next).not.toHaveBeenCalled();
  });

  it('deletes only the current user’s records without a valid muscle group', async () => {
    mockDeleteMany.mockResolvedValue({ deletedCount: 3 });
    const res = makeResponse();
    const next = jest.fn();

    await deleteInvalidGroupWorkouts(
      { user: { id: '507f1f77bcf86cd799439011' } },
      res,
      next
    );

    const filter = mockDeleteMany.mock.calls[0][0];
    expect(filter.userId).toBe('507f1f77bcf86cd799439011');
    expect(filter.$or).toEqual(expect.arrayContaining([
      { muscleGroup: null },
      { muscleGroup: '' },
    ]));
    expect(res.body).toMatchObject({ success: true, deletedCount: 3 });
    expect(next).not.toHaveBeenCalled();
  });
});
