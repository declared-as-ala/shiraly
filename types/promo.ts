export type PromoType = 'PERCENTAGE' | 'FIXED_AMOUNT';

export type PromoApplicableTo = 'ALL_PRODUCTS' | 'SPECIFIC_PRODUCTS' | 'SPECIFIC_CATEGORIES';

export type PromoCodeData = {
  id: string;
  code: string;
  description?: string;
  type: PromoType;
  value: number;
  minimumOrderAmount?: number;
  maximumDiscountAmount?: number;
  startsAt?: string;
  expiresAt?: string;
  usageLimit?: number;
  usageCount: number;
  perUserLimit?: number;
  active: boolean;
  applicableTo: PromoApplicableTo;
  selectedProductIds: string[];
  selectedCategoryIds: string[];
  createdAt: string;
  updatedAt: string;
};

export type PromoCodeCreateInput = {
  code: string;
  description?: string;
  type: PromoType;
  value: number;
  minimumOrderAmount?: number;
  maximumDiscountAmount?: number;
  startsAt?: string;
  expiresAt?: string;
  usageLimit?: number;
  perUserLimit?: number;
  active?: boolean;
  applicableTo?: PromoApplicableTo;
  selectedProductIds?: string[];
  selectedCategoryIds?: string[];
};

export type PromoCodeUpdateInput = Partial<PromoCodeCreateInput>;

export type PromoAppliedState = {
  code: string;
  type: PromoType;
  value: number;
  discountAmount: number;
  description?: string;
};

export type PromoValidationResult = {
  valid: boolean;
  code: string;
  type?: PromoType;
  value?: number;
  discountAmount?: number;
  description?: string;
  error?: string;
};

export type PromoListQuery = {
  page?: number;
  perPage?: number;
  search?: string;
  active?: boolean;
  type?: PromoType;
  expired?: boolean;
  sort?: string;
  order?: 'asc' | 'desc';
};

export type PromoListResult = {
  items: PromoCodeData[];
  total: number;
  totalPages: number;
  page: number;
};
