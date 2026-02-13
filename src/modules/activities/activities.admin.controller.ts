import { Body, Controller, Delete, Get, Param, Post, Put, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/jwt.guard';
import { Roles } from '../auth/roles.decorator';
import { RolesGuard } from '../auth/roles.guard';
import { ActivitiesService } from './activities.service';
import { CreateActivityDto, UpdateActivityDto } from './dto';

@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('admin')
@Controller('admin/activities')
export class AdminActivitiesController {
  constructor(private activities: ActivitiesService) {}

  @Get()
  async list() {
    return this.activities.listAdmin();
  }

  @Post()
  async create(@Body() dto: CreateActivityDto) {
    return this.activities.create(dto);
  }

  @Put(':id')
  async update(@Param('id') id: string, @Body() dto: UpdateActivityDto) {
    return this.activities.update(id, dto);
  }

  @Delete(':id')
  async remove(@Param('id') id: string) {
    return this.activities.remove(id);
  }
}
