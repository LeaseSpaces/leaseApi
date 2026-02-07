import request from 'supertest';
import { app } from '../app';

// const token = 'Bearer mock_jwt_token';

describe('Leaderboard API', () => {
  it('GET /api/leaderboard - should return leaderboard data', async () => {
    const res = await request(app)
      .get('/api/leaderboard')
      // .set('Authorization', token);
    expect(res.statusCode).toBe(200);
    expect(res.body).toHaveProperty('leaderboard');
    expect(res.body).toHaveProperty('history');
  });
});
