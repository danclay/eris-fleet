/** Collection-ish */
export declare class Collection<KeyType, ValueType> extends Map<KeyType, ValueType> {
    constructor();
    find(func: (item: ValueType) => boolean): ValueType | undefined;
}
