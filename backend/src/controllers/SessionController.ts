import { Request, Response } from "express";
import AppError from "../errors/AppError";
import { getIO } from "../libs/socket";
import cache from "../libs/cache";

import AuthUserService from "../services/UserServices/AuthUserService";
import { SendRefreshToken } from "../helpers/SendRefreshToken";
import { RefreshTokenService } from "../services/AuthServices/RefreshTokenService";
import FindUserFromToken from "../services/AuthServices/FindUserFromToken";
import User from "../models/User";
import { SerializeUser } from "../helpers/SerializeUser";

export const store = async (req: Request, res: Response): Promise<Response> => {
  const { email, password } = req.body;
  const ip = req.ip || req.socket.remoteAddress;

  try {
    const { token, serializedUser, refreshToken } = await AuthUserService({
      email,
      password
    });

    const emailKey = `login_attempts:email:${email}`;
    const ipKey = `login_attempts:ip:${ip}`;
    await cache.del(emailKey);
    await cache.del(ipKey);

    SendRefreshToken(res, refreshToken);

    const io = getIO();

    io.of(serializedUser.companyId.toString()).emit(
      `company-${serializedUser.companyId}-auth`,
      {
        action: "update",
        user: {
          id: serializedUser.id,
          email: serializedUser.email,
          companyId: serializedUser.companyId,
          token: serializedUser.token
        }
      }
    );

    return res.status(200).json({
      token,
      user: serializedUser
    });
  } catch (err: any) {
    if (err instanceof AppError && err.message === "ERR_INVALID_CREDENTIALS") {
      const emailKey = `login_attempts:email:${email}`;
      const ipKey = `login_attempts:ip:${ip}`;

      const currentEmailAttempts = await cache.get(emailKey);
      const currentIpAttempts = await cache.get(ipKey);

      const newEmailAttempts = currentEmailAttempts ? Number(currentEmailAttempts) + 1 : 1;
      const newIpAttempts = currentIpAttempts ? Number(currentIpAttempts) + 1 : 1;

      await cache.set(emailKey, String(newEmailAttempts), "EX", 900);
      await cache.set(ipKey, String(newIpAttempts), "EX", 900);
    }
    throw err;
  }
};

export const update = async (
  req: Request,
  res: Response
): Promise<Response> => {
  const token: string = req.cookies.jrt;

  if (!token) {
    throw new AppError("ERR_SESSION_EXPIRED", 401);
  }

  const { user, newToken, refreshToken } = await RefreshTokenService(
    res,
    token
  );

  SendRefreshToken(res, refreshToken);

  return res.json({ token: newToken, user });
};

export const me = async (req: Request, res: Response): Promise<Response> => {
  const token: string = req.cookies.jrt;
  const user = await FindUserFromToken(token);
  if (!token) {
    throw new AppError("ERR_SESSION_EXPIRED", 401);
  }
  const serializedUser = await SerializeUser(user);
  return res.json({ user: serializedUser });
};

export const remove = async (
  req: Request,
  res: Response
): Promise<Response> => {
  const { id } = req.user;
  if (id) {
    const user = await User.findByPk(id);
    await user.update({ online: false });
  }
  res.clearCookie("jrt");

  return res.send();
};
