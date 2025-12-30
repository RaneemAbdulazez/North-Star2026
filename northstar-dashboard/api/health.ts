import { VercelRequest, VercelResponse } from '@vercel/node';

export default function handler(req: VercelRequest, res: VercelResponse) {
    res.status(200).json({
        status: 'ok',
        message: 'Vercel Function is working',
        time: new Date().toISOString()
    });
}
