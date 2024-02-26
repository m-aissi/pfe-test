import { ComponentFixture, TestBed } from '@angular/core/testing';

import { ArchetypePreviewComponent } from './archetype-preview.component';

describe('ArchetypePreviewComponent', () => {
  let component: ArchetypePreviewComponent;
  let fixture: ComponentFixture<ArchetypePreviewComponent>;

  beforeEach(() => {
    TestBed.configureTestingModule({
      declarations: [ArchetypePreviewComponent]
    });
    fixture = TestBed.createComponent(ArchetypePreviewComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
