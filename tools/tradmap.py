#!/usr/bin/env python3
"""Simplified -> Traditional character map for the characters used in the lessons.
Validated against Big5: any lesson character that cannot be encoded in Big5 is simplified-only
and must appear here; every mapped value must be encodable in Big5."""
import json, os, sys

import hsklib as H
BUILD = H.BUILD

PAIRS = """
东東 两兩 个個 为為 么麼 义義 习習 书書 仅僅 从從 们們 价價 会會 伞傘 传傳 体體 关關 兴興 内內 写寫 冲衝 决決
准準 几幾 划劃 则則 别別 劝勸 办辦 医醫 卖賣 卫衛 却卻 发發 后後 吗嗎 员員 咸鹹 响響 园園 国國 图圖 块塊 声聲
处處 头頭 妈媽 学學 对對 寻尋 尝嘗 屉屜 岁歲 师師 带帶 帮幫 并並 广廣 应應 开開 张張 当當 忆憶 总總 惯慣 护護
担擔 挤擠 摇搖 摊攤 断斷 无無 旧舊 时時 机機 条條 来來 标標 树樹 样樣 楼樓 欢歡 气氣 没沒 浆漿 润潤 涨漲
温溫 湿濕 灵靈 点點 烦煩 热熱 爱愛 爷爺 犹猶 猫貓 现現 电電 盐鹽 着著 砖磚 确確 碍礙 离離 种種 筑築 红紅
纪紀 练練 终終 经經 给給 绝絕 维維 绿綠 缝縫 脑腦 腾騰 节節 虑慮 虽雖 见見 视視 觉覺 认認 让讓 记記 许許
论論 识識 诉訴 试試 话話 该該 说說 请請 读讀 谈談 谐諧 谓謂 谢謝 质質 贵貴 车車 转轉 轰轟 轻輕 载載 辞辭
边邊 过過 还還 这這 进進 迹跡 适適 递遞 邮郵 里裡 钟鐘 钱錢 铁鐵 铺鋪 锅鍋 错錯 镜鏡 门門 问問 间間 随隨
难難 静靜 须須 顿頓 题題 飘飄 飞飛 饭飯 饮飲 馆館 马馬 鱼魚 鲜鮮 鸟鳥 鸡雞 鸣鳴 黄黃 齐齊 松鬆 愿願 员員
"""

# words whose traditional form differs from a plain character-by-character mapping
WORDS = {
    "面包": "麵包",
    "周末": "週末",
    "一只": "一隻",
    "舍不得": "捨不得",
}


def load_map():
    m = {}
    for pair in PAIRS.split():
        assert len(pair) == 2, pair
        m[pair[0]] = pair[1]
    return m


def main():
    m = load_map()
    chars = json.load(open(os.path.join(BUILD, 'chars_legacy.json'), encoding='utf-8'))
    problems = []
    for c in chars:
        try:
            c.encode('big5')
            shared = True
        except UnicodeEncodeError:
            shared = False
        if not shared and c not in m:
            problems.append(f'simplified-only char {c!r} has no traditional mapping')
    for s, t in m.items():
        try:
            t.encode('big5')
        except UnicodeEncodeError:
            problems.append(f'mapped value {t!r} for {s!r} is not a Big5 character')
        if s not in chars and s not in '愿':
            pass  # unused entries are harmless
    for w, t in WORDS.items():
        for c in w:
            if c not in chars:
                problems.append(f'override word {w!r} uses char not in lessons')
    unused = [s for s in m if s not in chars]
    if problems:
        print('\n'.join(problems))
        sys.exit(1)
    print(f'OK: {len(m)} mappings, {len(WORDS)} word overrides; unused entries: {"".join(unused)}')
    json.dump({'chars': m, 'words': WORDS}, open(os.path.join(BUILD, 'trad.json'), 'w', encoding='utf-8'),
              ensure_ascii=False, separators=(',', ':'))


if __name__ == '__main__':
    main()
