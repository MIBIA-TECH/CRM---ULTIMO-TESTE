import { Op, fn, col, where } from "sequelize";
import { endOfDay, parseISO, startOfDay } from "date-fns";
import Campaign from "../../models/Campaign";
import { isEmpty } from "lodash";
import ContactList from "../../models/ContactList";
import Whatsapp from "../../models/Whatsapp";

interface Request {
  companyId: number | string;
  searchParam?: string;
  pageNumber?: string;
  status?: string;
  isRecurring?: string;
  startDate?: string;
  endDate?: string;
}

interface Response {
  records: Campaign[];
  count: number;
  hasMore: boolean;
}

const ListService = async ({
  searchParam = "",
  pageNumber = "1",
  companyId,
  status,
  isRecurring,
  startDate,
  endDate
}: Request): Promise<Response> => {
  let whereCondition: any = {
    companyId
  };

  if (!isEmpty(searchParam)) {
    whereCondition = {
      ...whereCondition,
      [Op.or]: [
        {
          name: where(
            fn("LOWER", col("Campaign.name")),
            "LIKE",
            `%${searchParam.toLowerCase().trim()}%`
          )
        }
      ]
    };
  }

  if (!isEmpty(status)) {
    whereCondition = {
      ...whereCondition,
      status
    };
  }

  if (isRecurring !== undefined && isRecurring !== "") {
    whereCondition = {
      ...whereCondition,
      isRecurring: isRecurring === "true"
    };
  }

  if (startDate || endDate) {
    let dateCondition: any = {};
    if (startDate) {
      dateCondition[Op.gte] = startOfDay(parseISO(startDate));
    }
    if (endDate) {
      dateCondition[Op.lte] = endOfDay(parseISO(endDate));
    }
    whereCondition = {
      ...whereCondition,
      scheduledAt: dateCondition
    };
  }

  const limit = 100;
  const offset = limit * (+pageNumber - 1);

  const { count, rows: records } = await Campaign.findAndCountAll({
    where: whereCondition,
    limit,
    offset,
    order: [["status", "ASC"], ["scheduledAt", "DESC"]],
    include: [
      { model: ContactList, attributes: ["id", "name"] },
      { model: Whatsapp, attributes: ["id", "name", "color"] }
    ]
  });

  const hasMore = count > offset + records.length;

  return {
    records,
    count,
    hasMore
  };
};

export default ListService;
