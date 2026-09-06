import { Union } from "../../common/type/common.interface";

export const Role = {
    CLIENT: 'Client',
    OWNER: 'Owner',
    DELIVERY: 'Delivery'
} as const;

export type Role = Union<typeof Role>;