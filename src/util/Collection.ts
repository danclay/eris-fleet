/** Collection-ish */
export class Collection<KeyType, ValueType> extends Map<KeyType, ValueType> {
	public constructor(iterable?: never) {
		super(iterable);
	}
	public find(func: (item: ValueType) => boolean): ValueType | undefined {
		for (const item of this.values()) {
			if (func(item)) {
				return item;
			}
		}
		return undefined;
	}
}