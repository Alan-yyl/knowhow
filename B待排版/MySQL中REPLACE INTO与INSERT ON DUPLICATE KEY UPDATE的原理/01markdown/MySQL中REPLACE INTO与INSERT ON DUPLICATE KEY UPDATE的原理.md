## REPLACE INTO

### 简介
`REPLACE INTO`是MySQL特有的扩展SQL语句，用于在插入数据时自动处理记录冲突的情况。它可以在一个语句中完成"如果存在则替换，不存在则插入"的逻辑。

### 基本语法
```sql
REPLACE INTO 表名 (列1, 列2, ...) VALUES (值1, 值2, ...);
-- 或
REPLACE INTO 表名 SET 列1=值1, 列2=值2, ...;
-- 或
REPLACE INTO 表名 SELECT ...;
```

### 工作原理
1. MySQL尝试插入一行新记录
2. 如果该行数据不违反主键或唯一索引约束，则正常插入
3. 如果违反主键或唯一索引约束（即有重复值）：
   - 先删除已存在的冲突记录
   - 然后插入新记录

本质上等同于执行：
```sql
DELETE FROM 表名 WHERE 主键或唯一键存在冲突;
INSERT INTO 表名 (列1, 列2, ...) VALUES (值1, 值2, ...);
```

### 使用示例
```sql
-- 创建示例表
CREATE TABLE users (
  id INT PRIMARY KEY,
  username VARCHAR(50) UNIQUE,
  email VARCHAR(100)
);

-- 插入记录
REPLACE INTO users (id, username, email) VALUES (1, 'user1', 'user1@example.com');

-- 替换已存在的记录
REPLACE INTO users (id, username, email) VALUES (1, 'user1', 'new_email@example.com');
```

### 注意事项
- 表必须有主键或唯一索引才能触发替换功能
- 会完全删除旧记录并创建新记录，而非UPDATE操作
- 未在REPLACE语句中明确指定的列将被设置为默认值
- 会重置自增ID（如果不是主键的话）
- 返回值为受影响的行数：插入为1，替换为2（1行删除+1行插入）
- 会触发DELETE和INSERT触发器，但不会触发UPDATE触发器

## INSERT ON DUPLICATE KEY UPDATE

### 执行过程
1. MySQL尝试执行普通的INSERT操作
2. 如果插入的数据不违反任何唯一约束(主键或唯一索引)，则正常插入成功
3. 如果发生唯一约束冲突：
   - 不删除现有记录
   - 将指定的UPDATE子句应用到已存在的记录上
   - 只更新显式指定的列，其他列保持不变

### 基本语法
```sql
INSERT INTO 表名 (列1, 列2, ...) 
VALUES (值1, 值2, ...)
ON DUPLICATE KEY UPDATE 列1=新值1, 列2=新值2, ...;
```

### 详细工作机制
- 在UPDATE部分可以引用VALUES()函数获取尝试插入的值
  - VALUES(列名)是一个特殊函数，用于引用当前INSERT语句中尝试插入的新值
  - 它允许你在UPDATE子句中使用这些原始插入值，而不需要重复指定
  - 例如：`visit_count = visit_count + VALUES(visit_count)` 表示将当前值加上尝试插入的新值
  - 非常适合计数器更新、累加操作或需要参考原始插入值的场景
- 可以有选择地更新部分列，不必更新所有冲突列
- 可以使用表达式或计算结果作为更新值
- 返回值：
  - 插入新行：影响行数为1
  - 更新已有行：影响行数为2
  - 没有变化：影响行数为0

### 高级用法示例
```sql
-- 使用VALUES()引用插入值
INSERT INTO visits (user_id, page, visit_count) 
VALUES (1, 'home', 1)
ON DUPLICATE KEY UPDATE visit_count = visit_count + VALUES(visit_count);

-- 条件更新
INSERT INTO products (id, name, stock) 
VALUES (101, 'Smartphone', 5)
ON DUPLICATE KEY UPDATE 
  stock = stock + VALUES(stock),
  name = IF(LENGTH(VALUES(name)) > LENGTH(name), VALUES(name), name);
```

### 内部实现细节
1. 获取写锁(行锁或表锁，取决于事务隔离级别)
2. 检查唯一键冲突
3. 如果存在冲突，将INSERT转换为UPDATE操作
4. 在同一事务中完成整个操作，保证原子性
5. 如果使用InnoDB，会复用已获取的锁

## 两种方法的对比

### REPLACE INTO vs INSERT ON DUPLICATE KEY UPDATE
| 特性 | INSERT ON DUPLICATE KEY UPDATE | REPLACE INTO |
|------|--------------------------------|--------------|
| 数据保留 | 保留未明确更新的列值 | 删除旧记录，所有未指定列重置为默认值 |
| 执行操作 | 一次UPDATE操作 | 一次DELETE + 一次INSERT操作 |
| 触发器 | 触发INSERT或UPDATE触发器 | 触发DELETE和INSERT触发器 |
| 灵活性 | 可以有选择地、有条件地更新 | 简单但不够灵活 |
| 自增ID | 保持不变 | 可能会变化(如果不是主键) |
| 性能 | 通常更高效(特别是有多个索引的表) | 需要额外的删除操作 |

- `REPLACE INTO`：
  - 完全删除冲突记录再插入
  - 会重置未指定列为默认值
  - 操作简单但可能丢失数据

- `INSERT ON DUPLICATE KEY UPDATE`：
  - 只更新指定的列，保留其他列原有值
  - 更灵活，可以有条件地更新
  - 不会触发DELETE触发器
  
```sql
-- 对比示例
INSERT INTO users (id, username, email) 
VALUES (1, 'user1', 'new_email@example.com')
ON DUPLICATE KEY UPDATE email='new_email@example.com';
```

### 适用场景
- `REPLACE INTO`：
  - 需要完全替换记录的场景
  - 简单操作，不关心旧数据
  - 数据导入或批量处理
  
- `INSERT ON DUPLICATE KEY UPDATE`：
  - 计数器更新
  - 需要保留部分历史数据的更新
  - 有条件的数据合并
  - 数据汇总或统计更新

## 性能考虑
- 对于频繁写操作的表，`REPLACE INTO`可能会导致更多的I/O操作和索引维护开销，因为它执行了删除和插入两个操作
- `INSERT ON DUPLICATE KEY UPDATE`通常更高效，特别是对于有多个索引的表
- 在高并发环境中，`INSERT ON DUPLICATE KEY UPDATE`可能有更好的锁行为