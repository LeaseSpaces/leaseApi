import request from 'supertest';
import { app } from '../app';

const token = 'Bearer mock_jwt_token';

describe('Tickets API', () => {
  it('GET /api/tickets - should return tickets list', async () => {
    const res = await request(app)
      .get('/api/tickets')
      .set('Authorization', token)
      .query({ page: 1, limit: 10 });
    expect(res.statusCode).toBe(200);
    expect(res.body).toHaveProperty('data');
    expect(res.body).toHaveProperty('pagination');
  });

  it('POST /api/tickets - should create a new ticket', async () => {
    const res = await request(app)
      .post('/api/tickets')
      .set('Authorization', token)
      .send({
        subject: 'Test Ticket',
        description: 'Test Description',
        category: 'General',
        priority: 'Medium',
        customerEmail: 'test@example.com',
        customerName: 'Test User'
      });
    expect(res.statusCode).toBe(201);
    expect(res.body).toHaveProperty('id');
    expect(res.body).toHaveProperty('ticketNumber');
  });
});
