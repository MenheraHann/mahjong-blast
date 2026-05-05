#!/usr/bin/env node
/**
 * 自动关卡生成器
 * 用法: node generate-level.js <总牌数> <层数> <暗牌数>
 * 示例: node generate-level.js 80 3 6
 *
 * 总牌数：必须是偶数
 * 层数：1-4（1表示只有L0，4表示L0-L3都有）
 * 暗牌数：0到总牌数/2之间
 */

const fs = require('fs');

// ============ 支撑规则检查 ============
function hasSupport(tiles, layer, row, col) {
    if (layer === 0) return true;
    const lowerTiles = tiles.filter(t => t.layer === layer - 1);
    return lowerTiles.some(lt =>
        Math.abs(row - lt.row) <= 1 && Math.abs(col - lt.col) <= 1
    );
}

function hasSelfLock(tiles, layer, row, col) {
    for (let dr = -1; dr <= 1; dr++) {
        for (let dc = -1; dc <= 1; dc++) {
            if (dr === 0 && dc === 0) continue;
            if (tiles.some(t => t.layer === layer && t.row === row + dr && t.col === col + dc)) {
                return true;
            }
        }
    }
    return false;
}

function canPlace(tiles, layer, row, col, maxRow, maxCol) {
    if (row < 0 || row > maxRow || col < 0 || col > maxCol) return false;
    if (tiles.some(t => t.layer === layer && t.row === row && t.col === col)) return false;
    if (!hasSupport(tiles, layer, row, col)) return false;
    if (hasSelfLock(tiles, layer, row, col)) return false;
    return true;
}

function verifyLevel(tiles, maxRow, maxCol) {
    for (const t of tiles) {
        if (!hasSupport(tiles, t.layer, t.row, t.col)) {
            return { ok: false, reason: `L${t.layer}(${t.row},${t.col}) 无支撑` };
        }
        if (hasSelfLock(tiles, t.layer, t.row, t.col)) {
            return { ok: false, reason: `L${t.layer}(${t.row},${t.col}) 自锁` };
        }
    }
    return { ok: true };
}

// ============ 关卡生成 ============
function generateLevel({ totalTiles, maxLayer, hiddenCount, rows = 12, cols = 10 }) {
    // 验证参数
    if (totalTiles % 2 !== 0) {
        throw new Error('总牌数必须是偶数');
    }
    if (maxLayer < 1 || maxLayer > 4) {
        throw new Error('层数必须在1-4之间');
    }
    if (hiddenCount < 0 || hiddenCount > totalTiles / 2) {
        throw new Error('暗牌数必须在0到总牌数/2之间');
    }

    const tiles = [];

    // 生成L0（底板） - 偶行偶列
    const L0positions = [];
    for (let r = 0; r <= rows; r += 2) {
        for (let c = 0; c <= cols; c += 2) {
            L0positions.push({ row: r, col: c });
        }
    }

    // 策略：根据层数决定L0数量
    let L0count = Math.min(L0positions.length, Math.ceil(totalTiles * 0.4));
    L0count = Math.max(L0count, Math.ceil(totalTiles / (maxLayer + 1)));

    // 打乱L0位置
    shuffleArray(L0positions);

    // 放置L0
    for (let i = 0; i < L0count && tiles.length < totalTiles; i++) {
        const pos = L0positions[i];
        tiles.push({ row: pos.row, col: pos.col, layer: 0, faceDown: false });
    }

    // 生成上层牌 - 逐个放置，每次重新检查
    for (let layer = 1; layer < maxLayer && tiles.length < totalTiles; layer++) {
        // 该层目标数量（递减）
        const targetCount = Math.floor((totalTiles - tiles.length) / (maxLayer - layer + 1));
        let placed = 0;

        // 随机尝试放置，多次尝试
        let attempts = 0;
        while (placed < targetCount && tiles.length < totalTiles && attempts < 1000) {
            const r = Math.floor(Math.random() * (rows + 1));
            const c = Math.floor(Math.random() * (cols + 1));

            if (canPlace(tiles, layer, r, c, rows, cols)) {
                tiles.push({ row: r, col: c, layer, faceDown: false });
                placed++;
            }
            attempts++;
        }
    }

    // 如果还没放满，随机填补空位
    let attempts = 0;
    while (tiles.length < totalTiles && attempts < 1000) {
        const layer = Math.floor(Math.random() * maxLayer);
        const r = Math.floor(Math.random() * (rows + 1));
        const c = Math.floor(Math.random() * (cols + 1));

        if (canPlace(tiles, layer, r, c, rows, cols)) {
            tiles.push({ row: r, col: c, layer, faceDown: false });
        }
        attempts++;
    }

    // 检查重复
    const seen = new Set();
    for (const t of tiles) {
        const key = `${t.layer}_${t.row}_${t.col}`;
        if (seen.has(key)) {
            throw new Error(`重复位置: ${key}`);
        }
        seen.add(key);
    }

    // 验证
    const verify = verifyLevel(tiles, rows, cols);
    if (!verify.ok) {
        throw new Error(`生成的关卡无效: ${verify.reason}`);
    }

    // 设置暗牌（随机选择上层牌）
    if (hiddenCount > 0) {
        const upperTiles = tiles.filter(t => t.layer >= 1);
        shuffleArray(upperTiles);
        for (let i = 0; i < Math.min(hiddenCount, upperTiles.length); i++) {
            const tile = tiles.find(t => t.layer === upperTiles[i].layer && t.row === upperTiles[i].row && t.col === upperTiles[i].col);
            if (tile) tile.faceDown = true;
        }
    }

    // 确保偶数张牌
    if (tiles.length % 2 !== 0) {
        const removable = tiles[tiles.length - 1];
        if (removable.layer >= 1) {
            tiles.splice(tiles.indexOf(removable), 1);
        }
    }

    // 统计
    const counts = [0, 0, 0, 0];
    for (const t of tiles) counts[t.layer]++;
    const hidden = tiles.filter(t => t.faceDown).length;

    return {
        tiles,
        stats: {
            total: tiles.length,
            L0: counts[0],
            L1: counts[1],
            L2: counts[2],
            L3: counts[3],
            hidden
        }
    };
}

function shuffleArray(arr) {
    for (let i = arr.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [arr[i], arr[j]] = [arr[j], arr[i]];
    }
}

// ============ 主程序 ============
const args = process.argv.slice(2);

if (args.length < 3) {
    console.log(`
╔═══════════════════════════════════════════════════╗
║           自动关卡生成器                           ║
╠═══════════════════════════════════════════════════╣
║ 用法: node generate-level.js <总牌数> <层数> <暗牌数> [输出文件]  ║
║                                                    ║
║ 参数说明:                                          ║
║   总牌数  - 总牌数量（必须是偶数）                  ║
║   层数    - 1-4（1=只有底层，4=四层全有）          ║
║   暗牌数  - 暗扣牌数量（0到总牌数/2）              ║
║   输出文件 - 可选，默认输出到控制台                  ║
║                                                    ║
║ 示例:                                              ║
║   node generate-level.js 80 3 6                    ║
║   node generate-level.js 100 4 10 level.json       ║
╚═══════════════════════════════════════════════════╝
    `);
    process.exit(1);
}

const totalTiles = parseInt(args[0]);
const maxLayer = parseInt(args[1]);
const hiddenCount = parseInt(args[2]);
const outputFile = args[3] || null;

try {
    const result = generateLevel({ totalTiles, maxLayer, hiddenCount });

    console.log('\n生成成功！');
    console.log('统计:', result.stats);

    if (outputFile) {
        const output = {
            level: 1,
            symmetry: 'horizontal',
            tiles: result.tiles
        };
        fs.writeFileSync(outputFile, JSON.stringify(output, null, 2));
        console.log(`已保存到: ${outputFile}`);
    } else {
        console.log('\n关卡数据:');
        console.log(JSON.stringify({
            level: 1,
            symmetry: 'horizontal',
            tiles: result.tiles
        }, null, 2));
    }
} catch (e) {
    console.error('生成失败:', e.message);
    process.exit(1);
}
