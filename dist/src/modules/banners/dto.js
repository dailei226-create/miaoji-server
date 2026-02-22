"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
var __metadata = (this && this.__metadata) || function (k, v) {
    if (typeof Reflect === "object" && typeof Reflect.metadata === "function") return Reflect.metadata(k, v);
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.UpdateBannerDto = exports.CreateBannerDto = exports.BANNER_TARGET_TYPES = exports.BANNER_POSITIONS = void 0;
const class_transformer_1 = require("class-transformer");
const class_validator_1 = require("class-validator");
exports.BANNER_POSITIONS = ['HOME', 'ACTIVITY', 'MARKET'];
exports.BANNER_TARGET_TYPES = [
    'NONE',
    'H5',
    'CREATOR',
    'WORK',
    'CATEGORY',
    'CATEGORY_L1',
    'CATEGORY_L2',
    'AUTHOR',
    'WORK_DETAIL',
    'TOPIC_NEW',
];
class CreateBannerDto {
}
exports.CreateBannerDto = CreateBannerDto;
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsString)(),
    (0, class_validator_1.MaxLength)(255),
    __metadata("design:type", String)
], CreateBannerDto.prototype, "title", void 0);
__decorate([
    (0, class_validator_1.IsString)(),
    (0, class_validator_1.MaxLength)(512),
    __metadata("design:type", String)
], CreateBannerDto.prototype, "imageUrl", void 0);
__decorate([
    (0, class_validator_1.IsIn)(exports.BANNER_POSITIONS),
    __metadata("design:type", String)
], CreateBannerDto.prototype, "position", void 0);
__decorate([
    (0, class_validator_1.IsIn)(exports.BANNER_TARGET_TYPES),
    __metadata("design:type", String)
], CreateBannerDto.prototype, "targetType", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsString)(),
    (0, class_validator_1.MaxLength)(191),
    __metadata("design:type", String)
], CreateBannerDto.prototype, "targetId", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsString)(),
    (0, class_validator_1.MaxLength)(512),
    (0, class_validator_1.ValidateIf)((o) => o.linkUrl !== undefined && o.linkUrl !== null && String(o.linkUrl).trim() !== ''),
    (0, class_validator_1.IsUrl)({ require_protocol: true }),
    __metadata("design:type", String)
], CreateBannerDto.prototype, "linkUrl", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsInt)(),
    (0, class_transformer_1.Type)(() => Number),
    __metadata("design:type", Number)
], CreateBannerDto.prototype, "sortOrder", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsBoolean)(),
    __metadata("design:type", Boolean)
], CreateBannerDto.prototype, "enabled", void 0);
class UpdateBannerDto {
}
exports.UpdateBannerDto = UpdateBannerDto;
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsString)(),
    (0, class_validator_1.MaxLength)(255),
    __metadata("design:type", String)
], UpdateBannerDto.prototype, "title", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsString)(),
    (0, class_validator_1.MaxLength)(512),
    __metadata("design:type", String)
], UpdateBannerDto.prototype, "imageUrl", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsIn)(exports.BANNER_POSITIONS),
    __metadata("design:type", String)
], UpdateBannerDto.prototype, "position", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsIn)(exports.BANNER_TARGET_TYPES),
    __metadata("design:type", String)
], UpdateBannerDto.prototype, "targetType", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsString)(),
    (0, class_validator_1.MaxLength)(191),
    __metadata("design:type", String)
], UpdateBannerDto.prototype, "targetId", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsString)(),
    (0, class_validator_1.MaxLength)(512),
    (0, class_validator_1.ValidateIf)((o) => o.linkUrl !== undefined && o.linkUrl !== null && String(o.linkUrl).trim() !== ''),
    (0, class_validator_1.IsUrl)({ require_protocol: true }),
    __metadata("design:type", String)
], UpdateBannerDto.prototype, "linkUrl", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsInt)(),
    (0, class_transformer_1.Type)(() => Number),
    __metadata("design:type", Number)
], UpdateBannerDto.prototype, "sortOrder", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsBoolean)(),
    __metadata("design:type", Boolean)
], UpdateBannerDto.prototype, "enabled", void 0);
//# sourceMappingURL=dto.js.map