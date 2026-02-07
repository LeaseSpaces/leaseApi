import axios from "axios";
import { Request, Response } from "express";

export const verifyFirebaseToken = async (req: Request, res: Response): Promise<any> => {
    try {
        const idToken = req.headers.authorization?.split("Bearer ")[1];
        if (!idToken) return res.status(401).json({ error: "No token provided" });

        const response = await axios.get(
            `https://oauth2.googleapis.com/tokeninfo?id_token=${idToken}`
        );

        const data = response.data;

        const user = {
            uid: data.user_id,
            email: data.email,
            name: data.name,
            picture: data.picture,
            provider: data.firebase_sign_in_provider || "unknown"
        };

        res.json({ user });
    } catch (err) {
        res.status(401).json({ error: "Invalid Firebase ID token" });
    }
};
