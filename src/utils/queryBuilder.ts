import type { FilterQuery, Query } from "mongoose";

type QueryParams = Record<string, unknown>;

class QueryBuilder<T> {
	public modelQuery: Query<T[], T>;
	public readonly query: QueryParams;

	constructor(modelQuery: Query<T[], T>, query: QueryParams) {
		this.modelQuery = modelQuery;
		this.query = query;
	}

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

		for (const field of excludeFields) {
			delete queryObj[field];
		}

		const cleanedQuery: Record<string, unknown> = {};
		for (const [key, value] of Object.entries(queryObj)) {
			if (value && value !== "" && value !== "all") {
				cleanedQuery[key] = value;
			}
		}

		this.modelQuery = this.modelQuery.find(cleanedQuery as FilterQuery<T>);
		return this;
	}

	sort(): this {
		const sortBy =
			(this.query?.sort as string)?.split(",").join(" ") || "-createdAt";
		this.modelQuery = this.modelQuery.sort(sortBy);
		return this;
	}

	paginate(): this {
		const page = Number(this.query?.page) || 1;
		const limit = Number(this.query?.limit) || 10;
		const skip = (page - 1) * limit;

		this.modelQuery = this.modelQuery.skip(skip).limit(limit);
		return this;
	}

	fields(): this {
		const selectFields =
			(this.query?.fields as string)?.split(",").join(" ") || "-__v";

		this.modelQuery = this.modelQuery.select(selectFields);
		return this;
	}

	async countTotal() {
		const filters = this.modelQuery.getFilter();
		const total = await this.modelQuery.model.countDocuments(filters);
		const page = Number(this.query?.page) || 1;
		const limit = Number(this.query?.limit) || 10;
		const totalPage = Math.ceil(total / limit);

		return { page, limit, total, totalPage };
	}

	build() {
		return this.modelQuery;
	}
}

export default QueryBuilder;
