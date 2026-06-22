import { Request, Response, NextFunction } from "express";
import cache from "../libs/cache";
import AppError from "../errors/AppError";
import { getClientIp } from "../helpers/getClientIp";

const loginLimiter = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  const { email } = req.body;
  const ip = getClientIp(req);

  if (!email) {
    return next();
  }

  const emailKey = `login_attempts:email:${email.trim().toLowerCase()}`;
  const ipKey = `login_attempts:ip:${ip}`;

  const emailAttempts = await cache.get(emailKey);
  const ipAttempts = await cache.get(ipKey);

  if (Number(emailAttempts) >= 3 || Number(ipAttempts) >= 3) {
    throw new AppError("ERR_TOO_MANY_LOGIN_ATTEMPTS", 429);
  }

  return next();
};

export default loginLimiter;
