import { FilterQuery, Query } from "mongoose";

type QueryParams = Record<string, unknown>;

class QueryBuilder<T> {
  public modelQuery: Query<T[], T>;
  public readonly query: QueryParams;

  constructor(modelQuery: Query<T[], T>, query: QueryParams) {
    this.modelQuery = modelQuery;
    this.query = query;
  }

  /**
   * Apply case-insensitive search across multiple fields.
   */
  search(searchableFields: string[]): this {
    const searchTerm = this.query?.searchTerm;
    if (searchTerm) {
      const regexQuery: Record<string, unknown> = {
        $or: searchableFields.map((field) => ({
          [field]: { $regex: searchTerm, $options: "i" },
        })),
      };
      this.modelQuery = this.modelQuery.find(regexQuery);
    }
    return this;
  }

  /**
   * Apply direct filtering excluding reserved fields.
   */
  filter(): this {
    const queryObj = { ...this.query };
    const excludeFields = [
      "searchTerm",
      "sort",
      "limit",
      "page",
      "fields",
      "search",
    ];

    // Remove reserved fields
    for (const field of excludeFields) {
      delete queryObj[field];
    }

    // Remove fields with empty values or "all" value
    const cleanedQuery: Record<string, unknown> = {};
    for (const [key, value] of Object.entries(queryObj)) {
      if (value && value !== "" && value !== "all") {
        cleanedQuery[key] = value;
      }
    }

    this.modelQuery = this.modelQuery.find(cleanedQuery as FilterQuery<T>);
    return this;
  }

  /**
   * Apply sorting based on query, defaulting to newest first.
   */
  sort(): this {
    const sortBy =
      (this.query?.sort as string)?.split(",").join(" ") || "-createdAt";
    this.modelQuery = this.modelQuery.sort(sortBy);
    return this;
  }

  /**
   * Apply pagination based on page and limit query params.
   */
  paginate(): this {
    const page = Number(this.query?.page) || 1;
    const limit = Number(this.query?.limit) || 10;
    const skip = (page - 1) * limit;

    this.modelQuery = this.modelQuery.skip(skip).limit(limit);
    return this;
  }

  /**
   * Limit fields returned from the query.
   */
  fields(): this {
    const selectFields =
      (this.query?.fields as string)?.split(",").join(" ") || "-__v";

    this.modelQuery = this.modelQuery.select(selectFields);
    return this;
  }

  /**
   * Get total document count and meta info for pagination.
   */
  async countTotal() {
    const filters = this.modelQuery.getFilter();
    const total = await this.modelQuery.model.countDocuments(filters);
    const page = Number(this.query?.page) || 1;
    const limit = Number(this.query?.limit) || 10;
    const totalPage = Math.ceil(total / limit);

    return { page, limit, total, totalPage };
  }

  /**
   * Return the final built Mongoose query.
   */
  build() {
    return this.modelQuery;
  }
}

export default QueryBuilder;
