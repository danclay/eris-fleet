/** Collection-ish */
export declare class Collection<KeyType, ValueType> extends Map<KeyType, ValueType> {
    constructor(iterable?: never);
    find(func: (item: ValueType) => boolean): ValueType | undefined;
}
