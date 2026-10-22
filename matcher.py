# -*- coding: utf-8 -*-
"""业务逻辑层：标签匹配核心算法（简化版，满足比赛演示）。

思路：给每条科普资源打多维度标签（主题标签、适配困扰类型），
用户点选的养生关注点 -> 生成用户标签集合 -> 计算标签重合度 -> 按得分排序。
"""
import json

# 各匹配维度的权重
W_CONCERN = 5      # 资源适配困扰命中一项
W_THEME = 2        # 资源主题标签命中一项

# 困扰类型 -> 主题标签（用于把用户关注点映射到主题维度）
CONCERN_THEME = {
    '睡眠差': ['睡眠', '作息', '熬夜', '助眠'],
    '肩颈痛': ['肩颈', '拉伸', '运动', '久坐'],
    '焦虑': ['情绪', '焦虑', '减压', '正念', '压力'],
    '肠胃差': ['肠胃', '膳食', '营养'],
    '脱发': ['脱发', '作息', '营养'],
    '视力疲劳': ['护眼', '久坐'],
    '免疫力低': ['免疫', '营养', '运动'],
    # 养生主题类（脾胃 / 气血 / 熬夜 / 清润）
    '脾胃养护': ['脾胃', '肠胃', '膳食'],
    '气血轻养': ['气血', '营养', '膳食'],
    '熬夜修复': ['熬夜', '作息', '睡眠', '护肝'],
    '清润降火': ['茶饮', '膳食', '祛湿'],
}


def _loads(value, default=None):
    """安全解析 JSON 字段。"""
    if not value:
        return default if default is not None else []
    if isinstance(value, (list, dict)):
        return value
    try:
        return json.loads(value)
    except (ValueError, TypeError):
        return default if default is not None else []


def build_profile(row):
    """由关注点采集记录构造用户画像（含展示标签与主题集合）。"""
    concerns = _loads(row['concerns'])

    tags = [c + '困扰' for c in concerns]

    themes = set()
    for c in concerns:
        themes.update(CONCERN_THEME.get(c, []))

    return {
        'user_id': row['user_id'],
        'concerns': concerns,
        'tags': tags,
        'themes': sorted(themes),
    }


def score_resource(resource, profile):
    """计算单条科普资源与用户画像的匹配得分及匹配理由。"""
    score = 0
    reasons = []

    concerns = profile.get('concerns', [])
    r_concerns = _loads(resource.get('concerns'))
    hits = [c for c in concerns if c in r_concerns]
    if hits:
        score += W_CONCERN * len(hits)
        reasons.append('对症你的困扰：' + '、'.join(hits))

    user_themes = set(profile.get('themes', []))
    r_themes = _loads(resource.get('theme_tags'))
    theme_hits = [t for t in r_themes if t in user_themes]
    if theme_hits:
        score += W_THEME * len(theme_hits)
        reasons.append('主题契合：' + '、'.join(theme_hits))

    return score, reasons


def rank_resources(resources, profile, limit=None):
    """对资源列表按匹配度排序，返回带 match_score / match_reasons 的列表。

    无画像时退化为按浏览量排序。
    """
    items = []
    for r in resources:
        item = dict(r)
        if profile:
            s, reasons = score_resource(item, profile)
            item['match_score'] = s
            item['match_reasons'] = reasons
            if s <= 0:
                continue  # 无任何标签重合则不进入个性化推荐
        else:
            item['match_score'] = 0
            item['match_reasons'] = []
        items.append(item)

    if profile:
        items.sort(key=lambda x: (-x['match_score'], -x.get('views', 0), -x.get('id', 0)))
    else:
        items.sort(key=lambda x: (-x.get('views', 0), -x.get('id', 0)))

    return items[:limit] if limit else items
