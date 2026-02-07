import request from 'supertest';
import { app } from '../app';

describe('Social Auth Routes', () => {
    it('POST /api/auth/google - should return JWT and user info', async () => {
        const res = await request(app)
            .post('/api/auth/google')
            .send({ access_token: 'mock_google_token' });
        expect(res.statusCode).toBe(200);
        expect(res.body).toHaveProperty('token');
        expect(res.body).toHaveProperty('user');
    });

    it('POST /api/auth/facebook - should return JWT and user info', async () => {
        const res = await request(app)
            .post('/api/auth/facebook')
            .send({ access_token: 'mock_facebook_token' });
        expect(res.statusCode).toBe(200);
        expect(res.body).toHaveProperty('token');
        expect(res.body).toHaveProperty('user');
    });

    it('POST /api/auth/apple - should return JWT and user info', async () => {
        const res = await request(app)
            .post('/api/auth/apple')
            .send({ access_token: 'mock_apple_token' });
        expect(res.statusCode).toBe(200);
        expect(res.body).toHaveProperty('token');
        expect(res.body).toHaveProperty('user');
    });
});
