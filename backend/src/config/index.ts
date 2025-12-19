import dotenv from 'dotenv';

dotenv.config();

export const config = {
    port: parseInt(process.env.PORT || '3001', 10),
    jwtSecret: process.env.JWT_SECRET || 'fallback-secret-not-for-production',
    jwtExpiresIn: 60 * 60 * 24 * 7, // 7 days in seconds
    bcryptRounds: 10,
};
