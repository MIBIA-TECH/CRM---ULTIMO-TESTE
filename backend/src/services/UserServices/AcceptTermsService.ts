import User from "../../models/User";
import AppError from "../../errors/AppError";
import ShowUserService from "./ShowUserService";

interface Request {
  userId: number;
  companyId: number;
}

const AcceptTermsService = async ({ userId, companyId }: Request): Promise<User> => {
  const user = await User.findOne({
    where: {
      id: userId,
      companyId
    }
  });

  if (!user) {
    throw new AppError("ERR_NO_USER_FOUND", 404);
  }

  await user.update({
    acceptedTerms: true,
    acceptedTermsAt: new Date()
  });

  // Retornar o usuário atualizado detalhado usando o ShowUserService para manter consistência
  const updatedUser = await ShowUserService(userId, companyId);

  return updatedUser;
};

export default AcceptTermsService;
