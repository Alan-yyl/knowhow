# Arrays.asList的陷阱与最佳实践

## 问题描述

`Arrays.asList()`是Java中常用的将数组转换为List的方法，但它有几个容易被忽视的陷阱，特别是在处理`null`值时。

### 陷阱1: 处理null参数

当传入一个`null`引用作为参数时，`Arrays.asList(null)`会将这个`null`视为一个元素，而不是创建一个空列表。它会返回一个包含单个`null`元素的列表。

```java
// 错误示例
Object result = null;
List<Object> list = Arrays.asList(result); // 返回[null]，而不是[]
System.out.println(list.size()); // 输出1，而不是0
System.out.println(list.get(0)); // 输出null
```

这可能导致意外行为，尤其是在后续代码中假设列表为空或非空的情况下。

### 陷阱2: 返回的List是固定大小的

`Arrays.asList()`返回的List是一个固定大小的列表，不支持添加或删除元素。

```java
// 错误示例
List<String> list = Arrays.asList("a", "b", "c");
list.add("d"); // 抛出UnsupportedOperationException
list.remove("a"); // 抛出UnsupportedOperationException
```

### 陷阱3: 原始类型数组的问题

当传入原始类型数组时，`Arrays.asList()`会将整个数组视为单个元素。

```java
// 错误示例
int[] numbers = {1, 2, 3};
List<Integer> list = Arrays.asList(numbers); // 实际上是List<int[]>，只有一个元素
System.out.println(list.size()); // 输出1，而不是3
```

## 最佳实践

### 处理可能为null的参数

```java
// 正确示例1: 使用条件判断
Object result = null;
List<Object> list;
if (result == null) {
    list = Collections.emptyList();
} else {
    list = Arrays.asList(result);
}
```

```java
// 正确示例2: 使用Optional
Object result = null;
List<Object> list = Optional.ofNullable(result)
    .map(r -> Arrays.asList(r))
    .orElseGet(Collections::emptyList);
```

### 创建可修改的List

```java
// 正确示例
List<String> list = new ArrayList<>(Arrays.asList("a", "b", "c"));
list.add("d"); // 正常工作
```

### 处理原始类型数组

```java
// 正确示例1: 使用流
int[] numbers = {1, 2, 3};
List<Integer> list = Arrays.stream(numbers).boxed().collect(Collectors.toList());
```

```java
// 正确示例2: 手动转换
int[] numbers = {1, 2, 3};
List<Integer> list = new ArrayList<>(numbers.length);
for (int number : numbers) {
    list.add(number);
}
```

## 总结

`Arrays.asList()`是一个有用的方法，但使用时需要注意其特性和限制：

1. 传入`null`参数会创建包含单个`null`元素的列表，而不是空列表
2. 返回的列表是固定大小的，不支持添加或删除元素
3. 处理原始类型数组时需要特别注意

通过理解这些陷阱并采用适当的最佳实践，可以避免在代码中出现意外行为和潜在的错误。
