import { VercelRequest, VercelResponse } from '@vercel/node';

export default function handler(req: VercelRequest, res: VercelResponse) {
    const vars = [
        'FIREBASE_PROJECT_ID',
        'FIREBASE_CLIENT_EMAIL',
        'FIREBASE_PRIVATE_KEY'
    ];

    const status: any = {};
    vars.forEach(v => {
        status[v] = process.env[v] ? 'Set' : 'MISSING';
        if (process.env[v]) {
            status[v + '_LENGTH'] = process.env[v]?.length;
        }
    });

    res.status(200).json({
        status: 'env_check',
        variables: status
    });
}
